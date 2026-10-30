"""MOCK_ONLY admission tests. No Unreal import, editor calls or UI input."""
import copy
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('manual_under_test', ROOT / 'scripts/Inspect-DiagnosticManual.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class Admission(unittest.TestCase):
    def setUp(self):
        self.core = helper.core_module()
        self.base, self.phase = self.core.load_base(), self.core.load_phase()
        self.now = datetime.datetime.now(datetime.timezone.utc)
        self.review = json.loads((helper.SELECTION / 'selection-review.json').read_text())
        self.baseline = json.loads((helper.SELECTION / 'baseline.json').read_text())
        self.identity = self.review['editor_identity']
        self.manifest = dict(self.core.plan(self.base), admission_route=helper.ROUTE,
            status='REVIEWED_MANUAL_NATIVE_READY', operator='USER_CONSOLE',
            automated_transition_acceptance='NOT_USED_NOT_PASSED', editor_identity=self.identity,
            reviewed_at_utc=self.now.isoformat(), protected_files=self.baseline['protected_files'],
            selection=self.review['selection'], mod_inventory=self.review['mod_inventory'],
            selection_review=self.pin(helper.SELECTION / 'selection-review.json'),
            manual_baseline=self.pin(helper.SELECTION / 'baseline.json'),
            review_files=[self.pin(helper.SELECTION / 'PROCEDURE.md')],
            pre_dispatch_log={'bytes': self.review['log_samples'][-1]['end_byte']})

    def pin(self, p):
        b=p.read_bytes()
        return dict(path=str(p), bytes=len(b), sha256=hashlib.sha256(b).hexdigest())

    def check(self):
        return helper.validate_contract(self.core, self.base, self.phase, self.manifest, self.identity, self.now)

    def test_complete_manual_contract(self):
        self.assertEqual(self.check(), self.now)

    def test_changed_identity_rejected(self):
        self.identity=dict(self.identity,pid=42)
        with self.assertRaisesRegex(ValueError,'EDITOR_IDENTITY_CHANGED'): self.check()

    def test_stale_and_future_review_rejected(self):
        for age in (-1,601):
            self.manifest['reviewed_at_utc']=(self.now-datetime.timedelta(seconds=age)).isoformat()
            with self.assertRaisesRegex(ValueError,'REVIEW_EXPIRED'): self.check()

    def test_route_and_readiness_rejected(self):
        for field in ('admission_route','status'):
            saved=self.manifest[field]; self.manifest[field]='NOT_READY'
            with self.assertRaises(ValueError): self.check()
            self.manifest[field]=saved

    def test_no_automated_claim_or_nonhuman_operator(self):
        for field in ('operator','automated_transition_acceptance'):
            saved=self.manifest[field]; self.manifest[field]='AUTOMATIC_PASS'
            with self.assertRaisesRegex(ValueError,'HUMAN_ROUTE_REQUIRED'): self.check()
            self.manifest[field]=saved

    def test_scope_and_explicit_load_rejected(self):
        for field,value in [('allow_load',True),('allow_exact_root_load',True),('targets',[])]:
            saved=self.manifest[field]; self.manifest[field]=value
            with self.assertRaisesRegex(ValueError,'FIXED_SCOPE_REQUIRED'): self.check()
            self.manifest[field]=saved

    def test_missing_protected_pin_rejected(self):
        self.manifest['protected_files']=self.manifest['protected_files'][:-1]
        with self.assertRaisesRegex(ValueError,'EXACT_PROTECTED_PINS_REQUIRED'): self.check()

    def test_wrong_selection_rejected(self):
        self.manifest['selection']=[]
        with self.assertRaisesRegex(ValueError,'EXACT_DIAGNOSTIC_SELECTION_REQUIRED'): self.check()

    def test_failed_manual_check_rejected(self):
        original=helper.read_pin
        for field in helper.CHECKS:
            altered=copy.deepcopy(self.review); altered['checks'][field]=False
            def substituted(core,record,exact=None,limit=512*1024**2):
                if record==self.manifest['selection_review']: return json.dumps(altered).encode()
                return original(core,record,exact,limit)
            with patch.object(helper,'read_pin',side_effect=substituted):
                with self.assertRaisesRegex(ValueError,'MANUAL_SELECTION_REVIEW_REQUIRED'): self.check()

    def test_inventory_binding_rejected(self):
        self.manifest['mod_inventory']=[]
        with self.assertRaisesRegex(ValueError,'MANUAL_REVIEW_BINDING_MISMATCH'): self.check()

    def test_unreviewed_log_gap_rejected(self):
        self.manifest['pre_dispatch_log']['bytes']+=1
        with self.assertRaises((ValueError, KeyError)): self.check()

    def test_reviewed_failure_continuity(self):
        failure=ROOT/'research/evidence/diagnostic-manual-inspection-20260927T041030Z-1c299360/FAILURE_REVIEW.json'
        closure=json.loads(failure.read_text())
        self.manifest['continuation_review']=self.pin(failure)
        self.manifest['pre_dispatch_log']=dict(bytes=closure['log']['end_byte'],path=closure['log']['path'],sha256=closure['log']['prefix_sha256'])
        self.assertEqual(self.check(),self.now)
        self.manifest['pre_dispatch_log']['bytes']+=1
        with self.assertRaisesRegex(ValueError,'FAILURE_CONTINUITY_GAP'): self.check()

    def test_review_required_and_changed_pin_rejected(self):
        self.manifest['review_files'][0]['sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'PIN_CHANGED'): self.check()
        self.manifest['review_files']=[]
        with self.assertRaisesRegex(ValueError,'SOURCE_REVIEW_REQUIRED'): self.check()

    def test_non_editor_entry_rejected(self):
        class Api: __name__='MOCK_ONLY'
        with self.assertRaisesRegex(ValueError,'NATIVE_EDITOR_API_REQUIRED'):
            helper.run_native(Api(), 'unused', '0'*64)

    def test_entry_is_deterministic_and_compiles(self):
        path=ROOT/'research/evidence/MOCK_ONLY/manifest.json'
        code=helper.render_entry(path,'1'*64,'2'*64)
        self.assertEqual(code,helper.render_entry(path,'1'*64,'2'*64))
        compile(code,'MOCK_ONLY','exec')


class LogAdmission(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='MW5-MOCK_ONLY-')
        self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'editor.log'; self.prefix=b'MOCK_ONLY prefix\n'
        self.command='py "reviewed/run.py"'
        self.since=datetime.datetime(2026,9,27,4,0,tzinfo=datetime.timezone.utc)
        self.now=self.since+datetime.timedelta(seconds=5)
        self.echo=b'[2026.09.27-04.00.01:123][ 12]Cmd: py "reviewed/run.py"\r\n'
        self.path.write_bytes(self.prefix+self.echo)
        st=self.path.stat()
        self.record=dict(path=str(self.path),bytes=len(self.prefix),sha256=helper.digest(self.prefix),stat_identity=[st.st_dev,st.st_ino],python_stat_version=list(sys.version_info[:3]))

    def check(self): helper.check_log(self.record,self.command,self.since,self.now)

    def test_exact_echo(self): self.check()

    def test_missing_extra_wrong_or_partial_echo(self):
        for tail in (b'',self.echo*2,self.echo+b'Warning: example\n',self.echo.replace(b'reviewed',b'other'),self.echo[:-1]):
            self.path.write_bytes(self.prefix+tail)
            with self.assertRaises(ValueError): self.check()

    def test_prefix_change(self):
        self.path.write_bytes(b'x'+self.prefix[1:]+self.echo)
        with self.assertRaisesRegex(ValueError,'LOG_PREFIX_CHANGED'): self.check()

    def test_identity_change(self):
        self.record['stat_identity']=[0,0]
        with self.assertRaisesRegex(ValueError,'LOG_ROTATED'): self.check()

    def test_wrong_runtime_rejected_before_rotation_check(self):
        self.record['python_stat_version']=[0,0,0]
        with self.assertRaisesRegex(ValueError,'LOG_IDENTITY_RUNTIME_MISMATCH'): self.check()

    def test_old_echo_rejected(self):
        self.since=self.now
        with self.assertRaisesRegex(ValueError,'COMMAND_OUTSIDE_REVIEW_WINDOW'): self.check()


if __name__=='__main__': unittest.main(verbosity=2)
