# Zira mission voice audition

Generated locally on 2026-09-20 after the user agreed to try Zira. **Listening trial only; the permanent voice remains unset.** These are six separate fictional mission situations, not live game observations or one continuous scene.

**User listening result, 2026-09-20: REJECTED.** The user disliked both samples and requested a free online AI voice generator. Preserve these files as the completed Zira trial; do not continue tuning Zira as the chosen voice.

- [Clean speech, 28.517 seconds](zira-clean.wav)
- [Radio treatment, 28.517 seconds](zira-radio.wav)

Both reels contain identical speech in identical order and timing:

1. Heard you.
2. No confirmation. I'm keeping that separate from success.
3. Critical damage to my left arm.
4. I can't confirm a casualty. We don't have reliable pilot status.
5. Quiet for the moment. I'm suspicious already.
6. Withdrawal understood. No more target suggestions.

The arm refers to her mech. The dry remark occurs in an explicitly safe mission lull. The [input manifest](../../synthetic/zira-audition.json) records every fictional context. A separate assistant agent reviewed all six lines and found no semantic issue. No spoken claim implies a completed game command.

## Generation and comparison

Microsoft Zira Desktop, en-US, using the installed Windows System.Speech engine. Rate 0, volume 90, 24 kHz / 16-bit / mono WAV. Six raw clips are retained in `raw/`; individually processed clean/radio clips are beside the reels. No network API, microphone capture, automatic playback or game access was used. **Speech API fees: $0.** Ordinary Codex work remains subject to the user's existing plan.

Clean clips receive level adjustment. Radio clips add a 250 Hz high-pass filter, a 3.6 kHz low-pass filter, gentle soft saturation and original quiet 25 ms transmission tones. Both use an active-speech RMS target of -22 dBFS, constrained by a -3 dBFS sample-peak ceiling. This is approximate level matching, not perceptual loudness certification. No copied game sounds or voice cloning are used. Zira is not prompted to act an emotion; the words supply the attitude.

[Generation record](generation.json) identifies the engine, source hash and offline generation times. [Audio checks](audio-checks.json) preserve the generation-time snapshot of duration, format, sample peaks and hashes for all 14 processed files. Every file reopened successfully, contained non-silent samples and had zero clipped samples. These checks do not assess pronunciation, intelligibility or emotional delivery. The later user listening result is recorded above. Gameplay noise, interruption and in-game latency remain **NOT_PERFORMED**.

## Reproduction

[New-ZiraAudition.ps1](../../scripts/New-ZiraAudition.ps1) creates raw files using the documented [Windows WAV-output method](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer.setoutputtowavefile?view=netframework-4.8.1). In this session the restricted process could enumerate voices but could not initialize synthesis. The same script succeeded with normal Windows permissions in Windows PowerShell 5.1. No system speech settings were changed.

[Finish-ZiraAudition.py](../../scripts/Finish-ZiraAudition.py) creates the two treatments using the bundled Python and NumPy, with no downloads. The scripts preserve existing outputs and refuse to overwrite this completed trial. A future iteration should use a new explicit audition directory. No launcher, background service or game bridge was created.

Provider, character biography and persona revisions remain separate decisions. The earlier cloud audition was not generated or charged.
