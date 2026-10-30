"""MOCK_ONLY reference algorithm, not an Unreal adapter or runnable mod.

The supplied source/UI objects are test doubles with project-local methods.
There is no native import, filesystem write, asset load, component creation,
timer or game command. Returned arrays and getter allocations remain outside
this formatter's bounds; only inspected slots and retained text are bounded.
The UI.add exception guard is a test-adapter precaution. Native AddToViewport
is void; this model proposes no success Boolean or Blueprint exception node.
A human must observe the first marker before requesting the snapshot.
"""
from dataclasses import dataclass, field
from collections.abc import Sequence

CLASSIFICATION = 'MOCK_ONLY'
STATIC_MARKER = 'CONTROL A — OUTPUT ONLY'
BASE_CLASS = '/Game/Objects/_common/Components/PlayerControllerComponents/PlayerControllerComponent.PlayerControllerComponent_C'
PROBE_CLASS = '/LanceObserverProbe/BP_LanceObserverProbeComponent.BP_LanceObserverProbeComponent_C'
MAX_ENTRIES = 32
MAX_TOTAL_UNITS = 4096
MAX_PAGE_UNITS = 768
MAX_BODY_UNITS = 600
MAX_SUMMARY_BODY_UNITS = 640
MAX_PAGE_LINES = 16
MAX_SEGMENT_UNITS = 40
MAX_PATH_UNITS = 256
MAX_LEVEL_UNITS = 128
# All 1..70 page counts and three statuses require at most 91 units. The
# independent final decoration and aggregate checks remain mandatory.
HEADER_RESERVE = 96
SUMMARY_RESERVE = 1536
MAX_PAGES = 70
MAX_ARRAY_COUNT = 2147483647


class BoundError(ValueError):
    pass


class ControllerEnded(RuntimeError):
    pass


def units(text, limit=MAX_TOTAL_UNITS):
    """Stop at limit+1; never encode or format an unchecked long string."""
    if not isinstance(text, str):
        raise BoundError('INVALID_TEXT')
    count = 0
    for character in text:
        value = ord(character)
        if 0xD800 <= value <= 0xDFFF:
            raise BoundError('INVALID_UNICODE')
        count += 2 if value > 0xFFFF else 1
        if count > limit:
            raise BoundError('TEXT_LIMIT')
    return count


def checked_identity(text, limit):
    length = units(text, limit)
    if not length or any(ord(character) < 32 or ord(character) == 127 for character in text):
        raise BoundError('INVALID_IDENTITY')
    return text


def _segments(text, maximum_width):
    checked_identity(text, MAX_PATH_UNITS)
    lines, segment, width = [], [], 0
    for character in text:
        size = 2 if ord(character) > 0xFFFF else 1
        if width + size > maximum_width:
            lines.append(''.join(segment))
            segment, width = [], 0
        segment.append(character)
        width += size
    if segment:
        lines.append(''.join(segment))
    return lines


def path_segments(text):
    """Bounded paths use 40-unit segments; supplementary pairs never split."""
    return _segments(text, MAX_SEGMENT_UNITS)


def _fixed_segments(text):
    # Only fixed ASCII labels/reason vocabulary and bounded decimal counters
    # use this width. Untrusted object/class/level paths never enter here.
    return _segments(text, 64)


def body(lines, limit=MAX_BODY_UNITS):
    # Every dynamic field is already bounded before joining.
    if len(lines) + 3 > MAX_PAGE_LINES:
        raise BoundError('LINE_LIMIT')
    required = sum(units(line, limit) for line in lines) + max(0, len(lines) - 1)
    if required > limit:
        raise BoundError('BODY_LIMIT')
    return '\n'.join(lines)


def decorate(text, page_index, total_pages, status):
    if not 0 <= page_index < total_pages <= MAX_PAGES:
        raise BoundError('PAGE_COUNT_LIMIT')
    if status not in ('COMPLETE', 'INCOMPLETE', 'NOT_COLLECTED'):
        raise BoundError('STATUS_REQUIRED')
    first = 'SNAPSHOT 1 - NOT LIVE | PAGE {}/{}'.format(page_index + 1, total_pages)
    second = 'STATUS: ' + status
    footer = 'F8: next saved page; stops at end'
    overhead = units(first) + units(second) + units(footer) + 3
    if overhead > HEADER_RESERVE:
        raise BoundError('HEADER_LIMIT')
    required = units(text, MAX_SUMMARY_BODY_UNITS if page_index == 0 else MAX_BODY_UNITS) + overhead
    if required > MAX_PAGE_UNITS or len(text.split('\n')) + 3 > MAX_PAGE_LINES:
        raise BoundError('PAGE_LIMIT')
    return first + '\n' + second + '\n' + text + '\n' + footer


def validate_storage(pages):
    """Final checks count all actual headers, newlines and footer text."""
    if not pages or len(pages) > MAX_PAGES:
        raise BoundError('PAGE_COUNT_LIMIT')
    total = 0
    for page in pages:
        total += units(page, MAX_PAGE_UNITS)
        if len(page.split('\n')) > MAX_PAGE_LINES:
            raise BoundError('LINE_LIMIT')
        if total > MAX_TOTAL_UNITS:
            raise BoundError('TOTAL_LIMIT')
    return total


@dataclass(frozen=True)
class Identity:
    object_path: str
    class_path: str
    level: str
    valid: bool = True


@dataclass(frozen=True)
class ComponentIdentity:
    # Fixture convenience only; capture uses separate class and object getters.
    object_path: str
    class_path: str
    class_valid: bool = True


@dataclass(frozen=True)
class ClassIdentity:
    # MOCK_ONLY composite: GetObjectClass -> validity -> path if valid.
    # This method signature is not an Unreal/Blueprint API claim.
    class_path: str
    valid: bool = True


@dataclass
class Snapshot:
    returned: int = 0
    returned_known: bool = False
    visited: int = 0
    valid_class_checks: int = 0
    exact_matching_entries: int = 0
    retained_rows: int = 0
    invalid_entries: int = 0
    detail_storage_closed: bool = False
    class_scan_complete: bool = False
    detailed_output_complete: bool = False
    reasons: list = field(default_factory=list)
    rows: list = field(default_factory=list)
    status: str = 'NOT_COLLECTED'

    def mark(self, reason):
        if reason not in self.reasons:
            self.reasons.append(reason)

    def complete(self, finalization_failed=False):
        self.class_scan_complete = (self.returned_known and self.returned <= MAX_ENTRIES and
                                    self.returned == self.visited == self.valid_class_checks)
        self.detailed_output_complete = (self.class_scan_complete and self.retained_rows == self.returned and
                                         not self.detail_storage_closed and not finalization_failed)


class ReferenceController:
    """Finite F8/EndPlay state model using injected MOCK_ONLY test doubles."""
    def __init__(self, ui, source):
        self.ui, self.source = ui, source
        self.control_attempted = False
        self.control_failed = False
        self.snapshot_attempted = False
        self._capture_started = False
        self.pages_ready = False
        self.ended = False
        self._busy = False
        self.widget = None
        self.components = None
        self.pages = ()
        self.page_index = 0
        self.displayed = None
        self.snapshot = Snapshot()
        self.last_issue = None

    def _external(self, function, *args):
        result = function(*args)
        if self.ended:
            raise ControllerEnded('Teardown occurred during callback')
        return result

    def press(self):
        if self.ended or self._busy:
            return self.displayed
        self._busy = True
        try:
            if not self.control_attempted:
                self.control_attempted = True
                self.widget = self._external(self.ui.create_widget, STATIC_MARKER)
                if self._external(self.ui.valid, self.widget):
                    self._external(self.ui.add, self.widget)
                    self.displayed = STATIC_MARKER
                else:
                    self.control_failed = True
                    self.last_issue = 'INVALID_CONTROL_WIDGET'
                return self.displayed
            if not self.snapshot_attempted:
                self.snapshot_attempted = True
                if self.control_failed:
                    self.last_issue = 'INITIAL_CONTROL_FAILED'
                    return self.displayed
                if not self._external(self.ui.valid, self.widget):
                    self.last_issue = 'INVALID_CONTROL_WIDGET'
                    return self.displayed
                self._capture()
                return self.displayed
            # Later presses read only the stored pages and widget validity.
            if self.pages_ready and self._external(self.ui.valid, self.widget) and self.page_index + 1 < len(self.pages):
                self.page_index += 1
                self._external(self.ui.set_text, self.widget, self.pages[self.page_index])
                self.displayed = self.pages[self.page_index]
            return self.displayed
        except ControllerEnded:
            return self.displayed
        except Exception:
            self.last_issue = 'CAPTURE_OR_DISPLAY_FAILURE' if self.snapshot_attempted else 'CONTROL_CREATION_FAILURE'
            if not self.snapshot_attempted:
                self.control_failed = True
            self.pages_ready = False
            self.pages = ()
            self.components = None
            self.snapshot.complete(finalization_failed=True)
            if self._capture_started:
                self.snapshot.status = 'INCOMPLETE'
            return self.displayed
        finally:
            self._busy = False

    def _show_not_collected(self, reason):
        # The historical method name denotes the error route, not its status:
        # once a query was attempted, partial collection is INCOMPLETE.
        if self.ended:
            raise ControllerEnded('No publication after teardown')
        self.last_issue = reason
        self.snapshot.status = 'INCOMPLETE' if self._capture_started else 'NOT_COLLECTED'
        self.snapshot.mark(reason)
        self.snapshot.complete(finalization_failed=True)
        lines = ['SNAPSHOT ' + self.snapshot.status.replace('_', ' ') + ': ' + reason,
                 self._match_line(self.snapshot)]
        if self._capture_started:
            lines += ['Returned: ' + (str(self.snapshot.returned) if self.snapshot.returned_known else 'UNKNOWN'),
                      'Visited: {} | Valid class checks: {}'.format(self.snapshot.visited, self.snapshot.valid_class_checks),
                      'Stored rows before failure: {}'.format(self.snapshot.retained_rows)]
        lines.append(self._completeness_line(self.snapshot))
        lines.append('Attempt consumed; further presses do not retry.')
        text = body([part for line in lines for part in _fixed_segments(line)], MAX_SUMMARY_BODY_UNITS)
        self._store_and_show([decorate(text, 0, 1, self.snapshot.status)])

    def _store_and_show(self, pages):
        if self.ended:
            raise ControllerEnded('No publication after teardown')
        validate_storage(pages)
        self.pages = tuple(pages)
        self.page_index = 0
        self.pages_ready = True
        self._external(self.ui.set_text, self.widget, self.pages[0])
        self.displayed = self.pages[0]

    def _capture(self):
        try:
            if self._external(self.source.paused) is not False:
                return self._show_not_collected('PAUSED_OR_UNKNOWN')
            if self._external(self.source.local) is not True:
                return self._show_not_collected('NONLOCAL_OR_UNKNOWN')
            base_valid, base_path = self._external(self.source.base_class)
            if base_valid is not True or base_path != BASE_CLASS:
                return self._show_not_collected('BASE_CLASS_INVALID_OR_CHANGED')
            identity = self._external(self.source.controller_identity)
            if identity.valid is not True:
                return self._show_not_collected('CONTROLLER_INVALID')
            try:
                checked_identity(identity.object_path, MAX_PATH_UNITS)
                checked_identity(identity.class_path, MAX_PATH_UNITS)
                checked_identity(identity.level, MAX_LEVEL_UNITS)
            except BoundError:
                return self._show_not_collected('CONTROLLER_IDENTITY_LIMIT_OR_INVALID')
            contexts = [
                body(['Captured Self object:'] + path_segments(identity.object_path)),
                body(['Captured Self class:'] + path_segments(identity.class_path)),
                body(['Captured level:'] + path_segments(identity.level) + ['Local at capture: TRUE', 'Selected base class:'] +
                     path_segments(BASE_CLASS)),
            ]
            # Admit a worst-case summary and all context decoration before
            # any component query. A legitimate but large identity can refuse.
            if (MAX_SUMMARY_BODY_UNITS + HEADER_RESERVE +
                    sum(units(value) + HEADER_RESERVE for value in contexts) > SUMMARY_RESERVE):
                return self._show_not_collected('SUMMARY_CONTEXT_LIMIT')
            # Sole query consumer: retain the returned sequence temporarily.
            self._capture_started = True
            self.components = self._external(self.source.query_components)
            if not isinstance(self.components, Sequence) or isinstance(self.components, (str, bytes)):
                return self._show_not_collected('ARRAY_INVALID')
            count = len(self.components)
            if not 0 <= count <= MAX_ARRAY_COUNT:
                return self._show_not_collected('ARRAY_COUNT_INVALID')
            result = self.snapshot
            result.returned = count
            result.returned_known = True
            if count > MAX_ENTRIES:
                result.mark('COUNT_LIMIT')
            row_bodies, reserved_rows = [], 0
            def retain_row(row, row_pair):
                nonlocal reserved_rows
                # Object/class pages form one row. Admit both or neither.
                reserve = sum(units(value, MAX_BODY_UNITS) + HEADER_RESERVE for value in row_pair)
                if (SUMMARY_RESERVE + reserved_rows + reserve > MAX_TOTAL_UNITS or
                        1 + len(contexts) + len(row_bodies) + len(row_pair) > MAX_PAGES):
                    result.detail_storage_closed = True
                    result.mark('TEXT_LIMIT')
                    return
                reserved_rows += reserve
                row_bodies.extend(row_pair)
                result.rows.append(row)
                result.retained_rows += 1

            for index in range(MAX_ENTRIES):
                if index >= count:
                    break
                component = self.components[index]
                result.visited += 1
                if self._external(self.source.component_valid, component) is not True:
                    result.invalid_entries += 1
                    result.mark('INVALID_ENTRY')
                    if result.detail_storage_closed:
                        continue
                    row = {'index': index, 'valid': False}
                    row_pair = [body(['Entry {}: INVALID ENTRY'.format(index)])]
                else:
                    item = self._external(self.source.component_class_identity, component)
                    try:
                        if item.valid is not True:
                            raise BoundError('INVALID_CLASS')
                        checked_identity(item.class_path, MAX_PATH_UNITS)
                    except BoundError:
                        result.invalid_entries += 1
                        result.mark('CLASS_LIMIT')
                        if not result.detail_storage_closed:
                            retain_row({'index': index, 'valid': False},
                                       [body(['Entry {}: CLASS CHECK INCOMPLETE'.format(index)])])
                        continue
                    result.valid_class_checks += 1
                    exact = item.class_path == PROBE_CLASS
                    result.exact_matching_entries += int(exact)
                    # Closed detail storage never reads/formats object paths;
                    # class checks still cover the bounded returned-array prefix.
                    if result.detail_storage_closed:
                        continue
                    object_path = self._external(self.source.component_object_path, component)
                    try:
                        checked_identity(object_path, MAX_PATH_UNITS)
                    except BoundError:
                        result.detail_storage_closed = True
                        result.mark('OBJECT_PATH_LIMIT')
                        continue
                    row = {'index': index, 'valid': True, 'object_path': object_path,
                           'class_path': item.class_path, 'exact_class_match': exact}
                    try:
                        row_pair = [
                            body(['Entry {} | OBJECT | exact match: {}'.format(index, exact), 'Object:'] +
                                 path_segments(object_path)),
                            body(['Entry {} | CLASS | exact match: {}'.format(index, exact), 'Class:'] +
                                 path_segments(item.class_path)),
                        ]
                    except BoundError:
                        # Explicit limits in an eventual Blueprint port; this
                        # exception is only the offline model's bound signal.
                        result.detail_storage_closed = True
                        result.mark('DETAIL_LIMIT')
                        continue
                retain_row(row, row_pair)
            if result.visited < result.returned:
                result.mark('UNVISITED_ENTRIES')
            if result.retained_rows < result.visited:
                result.mark('UNRETAINED_ENTRIES')
            result.complete()
            result.status = 'COMPLETE' if result.class_scan_complete and result.detailed_output_complete else 'INCOMPLETE'
            summary = self._summary(result)
            if sum(units(value) + HEADER_RESERVE for value in [summary] + contexts) > SUMMARY_RESERVE:
                return self._show_not_collected('SUMMARY_LIMIT')
            bodies = [summary] + contexts + row_bodies
            pages = [decorate(text, index, len(bodies), result.status) for index, text in enumerate(bodies)]
            self._store_and_show(pages)
        except ControllerEnded:
            return
        except Exception:
            self._show_not_collected('CAPTURE_FAILURE')
        finally:
            self.components = None

    @staticmethod
    def _match_line(result):
        return ('Captured array matching entries: {}'.format(result.exact_matching_entries)
                if result.class_scan_complete else 'PROBE MATCH TOTAL UNKNOWN')

    @staticmethod
    def _completeness_line(result):
        return 'Class scan complete: {} | Detailed output complete: {}'.format(
            str(result.class_scan_complete).upper(), str(result.detailed_output_complete).upper())

    @staticmethod
    def _summary(result):
        reasons = ', '.join(result.reasons) or 'NONE'
        # Reason vocabulary and count widths are fixed, not exception text.
        lines = [ReferenceController._match_line(result),
                 ReferenceController._completeness_line(result),
                 'Returned: {} | Visited: {} | Retained rows: {}'.format(result.returned, result.visited, result.retained_rows),
                 'Valid class checks: {} | Invalid class entries: {}'.format(result.valid_class_checks, result.invalid_entries),
                 'Matches among valid checked subset: {}'.format(result.exact_matching_entries),
                 'Counts are entries, not distinct objects.',
                 'Probe class resolution: NOT CHECKED (literal only)',
                 'Self == intended factory target: UNKNOWN',
                 'Reasons: ' + reasons]
        if result.returned > MAX_ENTRIES:
            lines.append('Inspection limited to first 32; actual visited count above.')
        return body([segment for line in lines for segment in _fixed_segments(line)], MAX_SUMMARY_BODY_UNITS)

    def end_play(self, reason):
        if self.ended:
            return
        self.ended = True
        try:
            if self.ui.valid(self.widget):
                self.ui.remove(self.widget)
        except Exception:
            self.last_issue = 'OWNED_WIDGET_CLEANUP_FAILURE'
        finally:
            self.widget = None
            self.components = None
            self.pages = ()
            self.snapshot = Snapshot()
            self.pages_ready = False
            self.displayed = None
            self.ui.parent_end_play(reason)
