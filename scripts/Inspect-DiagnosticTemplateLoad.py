"""Two fixed Blueprint resolutions followed by the existing ten-object inspector.

Native entry requires an independently reviewed manifest pin. Load absent exact
roots once each, stock first; stop on missing/alias without alternate paths.
No save/compile/reload/selection/restart calls. Native loading can load implicit
dependencies and perform engine post-load work. This is not fresh-process proof.
"""
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'research/OBSERVER_DIAGNOSTIC_TEMPLATE_LOAD_MANIFEST.json'
BASE = ROOT / 'scripts/Inspect-DiagnosticTemplates.py'
BASE_SHA = '8b92919782afdc799b2c415d7c18cba0282be24e0bf7c698e9a54500ecb018fd'


def load_base():
    raw = BASE.read_bytes()
    if hashlib.sha256(raw).hexdigest() != BASE_SHA:
        raise ValueError('BASE_HELPER_PIN_MISMATCH')
    spec = importlib.util.spec_from_file_location('_fixed_template_load_base', BASE)
    module = importlib.util.module_from_spec(spec)
    prior = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = prior
    return module


def assets(base):
    return [{"label": scope, "scope": scope, "name": 'InstantActionPlayerController',
             "object_path": base.PREFIXES[scope][:-2], "class_path": '/Script/Engine.Blueprint',
             "outer_path": base.PREFIXES[scope].split('.')[0]}
            for scope in ('stock', 'diagnostic')]


def validate(base, manifest, identity, now):
    if (manifest.get('allow_exact_path_load') is not True or manifest.get('allow_load') is not False
            or manifest.get('root_assets') != assets(base)):
        raise ValueError('EXACT_TWO_ROOT_LOAD_SCOPE_REQUIRED')
    # Reuse the unchanged target/owner/time/process admission. The subobject
    # phase remains already-loaded-only; loading permission is separate.
    base.validate_native_manifest(manifest, identity, now)
    if not re.fullmatch(r'diagnostic-template-load-\d{8}T\d{6}Z-[0-9a-f]{8}', manifest.get('attempt_id', '')):
        raise ValueError('EXACT_ATTEMPT_REQUIRED')
    if manifest.get('base_helper_sha256') != BASE_SHA:
        raise ValueError('BASE_MANIFEST_PIN_MISMATCH')


def execute(base, api, manifest, root, health_query, clock, native, guard=lambda: None, identity=None):
    roots = []

    def check_retained():
        guard()
        for target, obj in roots:
            base.object_identity(obj, target, {})

    def prepare(api, report, check, receipt):
        loading = report['loading']
        loading['status'] = 'RESOLVING'
        for target in assets(base):
            check()
            row = {'target': target, 'find_status': 'STARTED', 'load_status': 'NOT_PERFORMED'}
            loading['assets'].append(row)
            obj = api.find_asset(target['object_path'], follow_redirectors=False)
            row['find_status'] = 'ALREADY_LOADED' if obj is not None else 'MISSING'
            check()
            if obj is None:
                row['load_status'] = 'CALL_INTENDED'
                receipt('before-' + target['scope'] + '-load.json')
                check()
                loading['attempted_calls'] += 1
                row['load_status'] = 'CALL_ENTERED'
                obj = api.load_asset(target['object_path'], follow_redirectors=False)
                row['load_status'] = 'RETURNED_OBJECT' if obj is not None else 'RETURNED_NONE'
                check()
            if not base.object_identity(obj, target, row):
                loading['status'] = 'MISSING_ROOT_UNKNOWN'
                raise ValueError('EXACT_ROOT_UNAVAILABLE_UNKNOWN: ' + target['scope'])
            roots.append((target, obj))
            check()
        # Re-resolve both names after both loads; retained references alone do
        # not rule out an MW5 /Game query redirect installed by the second load.
        loading['post_load_rechecks'] = []
        for target, original in roots:
            check()
            row = {'target': target}
            loading['post_load_rechecks'].append(row)
            current = api.find_asset(target['object_path'], follow_redirectors=False)
            if not base.object_identity(current, target, row):
                raise ValueError('ROOT_DISAPPEARED_UNKNOWN')
            if current != original:
                raise ValueError('ROOT_REFERENCE_CHANGED_UNKNOWN')
            check()
        loading['status'] = 'EXACT_ROOT_IDENTITIES_OBSERVED'
        receipt('roots-resolved.json')

    final, _ = base.utilities()
    return base._inspect(api, manifest, root, final, health_query, clock, native,
                         check_retained, identity, prepare=prepare)


def run_mock(api, manifest, root, health_query, clock=time.monotonic):
    if getattr(api, '__name__', None) == 'unreal':
        raise ValueError('REAL_API_FORBIDDEN_IN_MOCK')
    return execute(load_base(), api, manifest, root, health_query, clock, False)


def run_native(api, manifest_sha256=None):
    base = load_base()
    if ROOT.resolve() != base.EXPECTED_ROOT.resolve() or getattr(api, '__name__', None) != 'unreal':
        raise ValueError('EXACT_PROJECT_EDITOR_REQUIRED')
    if not isinstance(manifest_sha256, str) or not re.fullmatch(r'[0-9a-f]{64}', manifest_sha256):
        raise ValueError('DORMANT_REVIEWED_MANIFEST_PIN_REQUIRED')
    manifest = json.loads(base.pinned_bytes(MANIFEST, manifest_sha256, base.MAX_RECEIPT))
    identity = base.process_identity()
    validate(base, manifest, identity, datetime.datetime.now(datetime.timezone.utc))
    if manifest.get('protected_files') != base.fixed_protected_inputs():
        raise ValueError('PROTECTED_SCOPE_MISMATCH')
    expected_markers = [str(base.EDITOR_EXE.parents[3] / 'MW5Mercs/Plugins' / name / 'ActiveMod.txt')
                        for name in ('LanceObserverProbe', 'LanceObserverDiagnosticControl')]
    if [str(Path(row['path'])) for row in manifest['selection']] != expected_markers:
        raise ValueError('SELECTION_SCOPE_MISMATCH')
    helper_sha = base.file_record(Path(__file__))[1]['sha256']
    if helper_sha != manifest.get('helper_sha256'):
        raise ValueError('REVIEWED_HELPER_PIN_MISMATCH')

    def guard():
        base.pinned_bytes(MANIFEST, manifest_sha256, base.MAX_RECEIPT)
        base.pinned_bytes(Path(__file__), helper_sha)
        base.pinned_bytes(BASE, BASE_SHA)
        for name, sha in base.UTILITY_PINS:
            base.pinned_bytes(ROOT / 'scripts' / name, sha)

    # Persistent one-attempt receipt prevents an accidental second dispatch.
    attempt = ROOT / 'research/evidence' / manifest['attempt_id']
    if not attempt.is_dir() or attempt.resolve() != attempt.absolute():
        raise ValueError('PREPARED_ATTEMPT_DIRECTORY_REQUIRED')
    with (attempt / 'native-dispatch-claim.json').open('x', encoding='utf-8') as stream:
        json.dump({'manifest_sha256': manifest_sha256, 'identity': identity,
                   'at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}, stream)
    _, common = base.utilities()
    return execute(base, api, manifest, ROOT, common.health, time.monotonic, True, guard,
                   {'manifest_sha256': manifest_sha256, 'helper_sha256': helper_sha,
                    'base_helper_sha256': BASE_SHA, 'editor_identity': identity})


if __name__ == '__main__':
    raise SystemExit('Import reviewed module and call run_native with its manifest pin; no automatic native execution.')
