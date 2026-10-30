"""Offline provenance and mutation checks; never imports Unreal or a fragment."""
import ast
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

FILE = Path(__file__).with_name('Prepare-B0TransitionInspectionSubset.py')
spec = importlib.util.spec_from_file_location('offline_transition_subset', FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Checks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload, cls.report = module.build()

    def refuse(self, payload=None, report=None):
        with self.assertRaises((ValueError,KeyError)):
            module.validate_fragment(self.payload if payload is None else payload,
                                     deepcopy(self.report) if report is None else report)

    def repin(self, payload, report=None):
        report = deepcopy(self.report) if report is None else report
        report['payload'] = {'bytes':len(payload), 'sha256':hashlib.sha256(payload).hexdigest()}
        return report

    def test_actual_sources_and_disconnected_subset(self):
        result = module.validate_fragment(self.payload,self.report)
        self.assertEqual(result,{'nodes':2,'pins':6,'connections':0,'exec_pins':0,'variables':0,'events':0,'source_semantics_preserved':True})
        self.assertNotIn(b'LinkedTo=',self.payload)

    def test_registered_authored_nodes_not_generated_repeats(self):
        one,two = [x['template'] for x in self.report['nodes']]
        self.assertEqual(one['record']['path'],'CaptureB0Snapshot.K2Node_CallFunction_2168')
        self.assertEqual(one['registration']['root_graph']['line'],12760)
        self.assertEqual(two['record']['path'],'OnReinforcementArrived.K2Node_CallFunction_2')
        self.assertEqual(two['registration']['root_graph']['line'],1402)

    def test_native_struct_reference_const_flags_preserved(self):
        text=self.payload.decode('utf-8')
        guidline=next(x for x in text.splitlines() if 'PinName="InGuid"' in x)
        self.assertIn('PinType.PinSubCategoryObject=ScriptStruct\'"/Script/CoreUObject.Guid"\'',guidline)
        self.assertIn('bIsReference=True,PinType.bIsConst=True',guidline)
        self.assertIn('bDefaultValueIsIgnored=True',guidline)

    def test_version_specific_wrapper_metadata_preserved(self):
        nodes=self.payload.decode('utf-8').split('Begin Object ')[1:]
        self.assertIn('PinType.bIsUObjectWrapper=True',next(x for x in nodes[0].splitlines() if 'PinName="self"' in x))
        self.assertIn('PinType.bIsUObjectWrapper=False',next(x for x in nodes[1].splitlines() if 'PinName="self"' in x))

    def test_schema_change_rejected_even_after_payload_repin(self):
        payload=self.payload.replace(b'PinType.PinCategory="string"',b'PinType.PinCategory="name"',1)
        self.refuse(payload,self.repin(payload))

    def test_return_default_change_rejected_even_after_repin(self):
        payload=self.payload.replace(b'DefaultValue="false"',b'DefaultValue="true"',1)
        self.refuse(payload,self.repin(payload))

    def test_owning_native_function_cannot_be_replaced(self):
        payload=self.payload.replace(b'MemberName="Len"',b'MemberName="NewGuid"',1)
        self.refuse(payload,self.repin(payload))

    def test_external_link_cannot_be_reintroduced(self):
        payload=self.payload.replace(b'PersistentGuid=',b'LinkedTo=(OldNode ABCDEF0123456789ABCDEF0123456789,),PersistentGuid=',1)
        self.refuse(payload,self.repin(payload))

    def test_extra_pin_cannot_be_invented(self):
        payload=self.payload.replace(b'End Object',b'   CustomProperties Pin (PinId=ABCDEF0123456789ABCDEF0123456789,PinName="Invented",PinType.PinCategory="int",)\r\nEnd Object',1)
        self.refuse(payload,self.repin(payload))

    def test_no_native_status_promotion(self):
        report=deepcopy(self.report)
        report['native_status']='PASS'
        self.refuse(report=report)

    def test_manifest_cannot_authorize_its_own_fabricated_schema(self):
        report=deepcopy(self.report)
        report['nodes'][0]['template']['record']['pins'][1]['text']=report['nodes'][0]['template']['record']['pins'][1]['text'].replace('PinCategory="string"','PinCategory="name"')
        payload=self.payload.replace(b'PinType.PinCategory="string"',b'PinType.PinCategory="name"',1)
        self.refuse(payload,self.repin(payload,report))

    def test_old_native_identity_cannot_be_reused(self):
        report=deepcopy(self.report)
        node=report['nodes'][0]
        payload=self.payload.replace(node['node_guid'].encode(),node['source_node_guid'].encode())
        node['node_guid']=node['source_node_guid']
        self.refuse(payload,self.repin(payload,report))

    def test_false_source_identity_cannot_mask_old_guid_reuse(self):
        report=deepcopy(self.report)
        node=report['nodes'][0]
        payload=self.payload.replace(node['node_guid'].encode(),node['source_node_guid'].encode())
        node['source_node_guid']='F'*32
        self.refuse(payload,self.repin(payload,report))

    def test_duplicate_empty_object_envelope_rejected(self):
        name=self.report['nodes'][0]['name']
        payload=self.payload+('Begin Object Class='+module.CLASS+' Name="'+name+'"\r\nEnd Object\r\n').encode()
        self.refuse(payload,self.repin(payload))

    def test_root_property_injection_rejected(self):
        payload=self.payload+b'InjectedProperty=True\r\n'
        self.refuse(payload,self.repin(payload))

    def test_removed_link_manifest_cannot_lie(self):
        report=deepcopy(self.report)
        report['nodes'][0]['removed_source_links']=[]
        self.refuse(report=report)

    def test_source_pin_drift_fails_closed(self):
        with tempfile.TemporaryDirectory(prefix='mw5-subset-pin-') as directory:
            path=Path(directory)/'changed.txt'
            path.write_bytes(b'changed source')
            with self.assertRaisesRegex(ValueError,'SOURCE_PIN_DRIFT'):
                module.read_pinned(path,'0'*64)

    def test_unregistered_compiled_graph_is_rejected(self):
        raw=module.read_pinned(module.REPO/module.BASELINE[0],module.BASELINE[1])
        records=module.index_source(raw.decode('utf-8-sig'),'InstantActionPlayerController')
        with self.assertRaisesRegex(ValueError,'SOURCE_NODE_OR_GRAPH_NOT_REGISTERED'):
            module.registration(records,records['EdGraph_4.K2Node_CallFunction_2168'])

    def test_manifest_roundtrip_and_no_overwrite(self):
        with tempfile.TemporaryDirectory(prefix='mw5-subset-output-') as directory:
            output=Path(directory)/'fresh'
            module.save(output)
            payload=(output/'recovered-pure-subset.fragment.txt').read_bytes()
            report=json.loads((output/'SUBSET_MANIFEST.json').read_text(encoding='utf-8'))
            module.validate_fragment(payload,report)
            before=hashlib.sha256(payload).hexdigest()
            with self.assertRaisesRegex(ValueError,'OUTPUT_EXISTS_NO_OVERWRITE'):
                module.save(output)
            self.assertEqual(hashlib.sha256((output/'recovered-pure-subset.fragment.txt').read_bytes()).hexdigest(),before)

    def test_python37_syntax_and_no_native_or_execution_imports(self):
        tree=ast.parse(FILE.read_text(encoding='utf-8'),feature_version=(3,7))
        imports={x.names[0].name.split('.')[0] for x in ast.walk(tree) if isinstance(x,ast.Import)}
        imports.update(x.module.split('.')[0] for x in ast.walk(tree) if isinstance(x,ast.ImportFrom))
        self.assertEqual(imports,{'argparse','datetime','hashlib','json','pathlib','re'})

if __name__=='__main__':
    unittest.main(verbosity=2)
