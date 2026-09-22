# Local engine resource policy

This policy applies to the workbench's explicit **Start local engines** action. It closes the gap where file recognition had resource admission checks but the larger resident language and voice engines could start without them. It does not enable game control or establish that this laptop can run the full mod workload.

Before each resident engine starts, the workbench requires **5 GiB available RAM** and **10 GiB free space on the project volume**. The RAM margin follows the existing conservative conversation-diagnostic admission policy; it is not a measured peak-memory guarantee. The second check occurs after language startup and before voice startup. If voice admission fails, the already-started language engine must also stop.

While the workbench owns starting/running engines, a nonoverlapping check samples available RAM every **250 ms**. A reading below **2 GiB**, an invalid/unavailable reading or a sample deadline failure cancels pending conversation, voice delivery and push-to-talk work and requests shutdown of the workbench's own engines. Disk is checked at admission, not continuously. No unrelated application is terminated, no cache is deleted and no threshold is exposed as a browser override.

These checks are reactive. Allocation between samples can consume the reserve, and process termination can fail or take time. The 250 ms interval is neither a guarantee of continuous available RAM nor an end-to-end shutdown latency measurement. This is a local preview policy, separate from the game's frame-time, RAM/VRAM and direct-control restoration acceptance tests.

## Cancellation and ownership

Resource sampling has a two-second public deadline. A timed-out or cancelled read that has not actually settled remains owned and blocks replacement work; it is not reported as cleaned up. Healthy sampling is distinct from such pending cleanup. No reads or monitor begin merely from constructing/opening the workbench.

Stopping resident engines immediately invalidates pending startup/generation/audio work. The stop caller waits at most six seconds; incomplete native stop, startup or resource cleanup remains visible as unconfirmed. An old asynchronous completion cannot start a later stage or clear a successor's ownership. Restart always requires an explicit action and a fresh admission check; there is no automatic restart after memory pressure.

Recognition receives a cancellation request and keeps its separate pending-cleanup status. The resident-engine stop result covers language and voice, not confirmed recognition drainage. Closing the whole workbench additionally requires the speech-input coordinator's shutdown confirmation. Browser microphone cleanup likewise remains separately observable; none of these fake tests proves the operating system's microphone indicator has cleared.

The browser disables new model/voice work while startup, stopping or cleanup is pending. It continues to request status while the resource monitor is active, allowing an asynchronous stop to invalidate downloaded/current audio. This is ordinary UI polling, not a game-control timing mechanism. Human tactical holds and native-control capability flags are unchanged.

The installed resource sampler uses Node's local memory and filesystem metadata APIs. Test injection is available only in trusted project code; request bodies cannot replace resource readings, thresholds or engine implementations. Standalone model tools are outside this workbench guard and retain their own documented experimental gates.

## Verification boundary

Meaningful offline checks cover resource refusal, changed headroom between engine starts, runtime reserve loss, unknown readings, pending cancellation, late completion, repeated starts, stop failures and resource ownership. Browser checks execute the actual client script against simulated DOM/network/audio. Native model inference, real audio output, game-loaded performance and sustained reserve acceptance are separate and remain unperformed for this increment. See the resulting [independent review](../research/WORKBENCH_RESOURCE_REVIEW.md) and [complete regression receipt](../research/COMPANION_VALIDATION.json) for the final tested revision.
