# ElevenLabs mission voice audition 001

Three real speech samples generated on 2026-09-20 using the ElevenLabs website and the account's Free plan. Each reads the same six fictional mission lines from `synthetic/zira-audition.json`, separated by blank lines. These are separate scenarios, not one continuous mission.

| Sample | Provider voice description | Accent |
| --- | --- | --- |
| [Laura](laura.mp3) | Enthusiast, Quirky Attitude | American |
| [Sarah](sarah.mp3) | Mature, Reassuring, Confident | American |
| [Lily](lily.mp3) | Velvety Actress | British |

The descriptions and accents are provider labels, not listening judgments.

Settings: Eleven Multilingual v2; speed 1.0; stability 0.50; similarity 0.75; style exaggeration 0; speaker boost on; language override off. Requested output: MP3, 44.1 kHz, 128 kbps. No radio effects were applied.

The website showed 266 characters per generation. Three generations used 798 free credits: 10,000 before and 9,202 after, verified in the website. No paid plan, payment details, or paid API were used. The files were downloaded using the site's Download latest control and copied into this folder; originals remain in Downloads.

Status: GENERATED_AND_DOWNLOADED; NEEDS_REFINEMENT. The user tentatively preferred Sarah but reported that the audio still feels AI-generated. Sarah is the current audition favorite; final audio acceptance and permanent voice selection remain unresolved. See [user-feedback.json](user-feedback.json) for the exact feedback. Generation-time metadata in generation.json is preserved as a historical record. Audio does not establish game integration, live mission awareness, or runtime latency. The pilot behavior sheet remains unchanged.

The [next audition text draft](next-audition-draft.txt) shortens the same six fictional situations into conversational radio lines. Proposed delivery: understated, conversational, and dry; urgent damage stays clear, and only the safe-lull line carries attitude. This direction is an editorial proposal, not a tested synthesis setting. No additional audio was generated or credits used in the feedback turn. More natural text may help the delivery, but it does not establish that the voice will sound human.

Technical verification: all three files contain complete, contiguous MPEG-1 Layer III frames, mono, 44,100 Hz, constant 128 kbps. A read-only Python frame parser found no truncated frames or unexplained trailing bytes. Encoded durations are Laura 16.901 seconds (647 frames), Sarah 17.633 seconds (675 frames), and Lily 18.416 seconds (705 frames); these may include encoder padding. No decoding, listening, transcript verification, or latency measurement was performed. File hashes and generation provenance are in [generation.json](generation.json).

The installed ChatGPT ElevenLabs plugin did not expose callable tools in the current Codex task, so generation used the signed-in website. The generated results are also retained in ElevenLabs Text to Speech History.

The user subsequently deferred actual voice work to a later session. Sarah remains the tentative favorite; further voice generation and tuning are parked.
