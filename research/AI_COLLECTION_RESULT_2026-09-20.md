# Expanded AI collection result

**OBSERVED: the user-started native collection finished.** Local date2026-09-20; run began2026-09-21T03:04:37Z. [Final report](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/report.json) status is `SCOPE_PROCESSED_REVIEW_COVERAGE`, with249/249entries processed in251.937seconds and no recorded collection errors. Completion means the reviewed list was processed; five entries did not produce source text, and native implementation/runtime gaps remain.

## Verified outputs

| Item | Verified result |
|---|---:|
| Source assets with collected text | 244 |
| New native source exports | 226 |
| Verified earlier source exports reused | 18 |
| Native Blueprint class-default exports | 128 |
| Source/default text files | 372 |
| Source/default text bytes | 38,246,732 |
| Generated API reference bytes | 21,026,350 |
| Recorded text/reference total | 59,273,082 bytes, about56.53MiB |
| Recorded dependency references / distinct packages | 1,455 / 451 |
| Unresolved referenced packages in coverage frontier | 222 |
| Incomplete/truncated dependency queries | 0 |

Independent read-only audit verified all249installed source bytes/hashes, every exported/reused text file and reuse origin, script/scope fingerprints, API snapshot versus its current installed source, and [coverage](evidence/editor-source/ai-research-collection-20260921T030437Z-f7d8e930/coverage.json) counts/frontier. Zero mismatches. Every eligible Blueprint in the collected set has a default-text result. Text success does not guarantee every inherited property or compiled method body was exported. The earlier immutable [partial audit](evidence/editor-source/ai-research-audit-20260921T030836Z-e264ce51/audit.json) remains evidence of progress at226/249, not the final totals.

Verified SHA256 identities:

```text
report.json              f5dbc2eeacbb81c0ea3e331651dfd40946b347fc219869246c48b9b853bc5eea
Collect-AIResearch.py     6924c6d7b0929799e28d664bd6188703a8a9ddc5d6fec2e032ae222904d8fea7
AI_RESEARCH_SCOPE.json    df691070fad853ec2de37b67de65ae246138ae07489290b20f01abe02835d0d3
coverage.json            f27a6ebe538594b11a595545d4c8ef3806539a977bb892c38edd7d76f863b151
unreal-api-reference.txt  ac4c46761bc54099302155bc0a908ae3f64b161ca77eb9afd0cc6c1f1b826480
```

## Five gaps within the reviewed list

| Package, relative to /Game | Recorded status |
|---|---|
| AI/Tank/Behaviors/BT_VTOLHoldPosition | INVALID_OR_REDIRECTED_METADATA |
| AI/Tank/Behaviors/BT_VTOLTeamOrders | INVALID_OR_REDIRECTED_METADATA |
| AI/_common/EQSQueries/EQS_RandomLocationNearTravelLocation | INVALID_OR_REDIRECTED_METADATA |
| AI/_common/Formations/DiamondFormation | METADATA_ONLY_UNSUPPORTED_CLASS: MWFormationAsset |
| Libraries/MW5_FunctionLibrary | METADATA_ONLY_DEFERRED: broad source above16MiBload threshold |

The first three small installed files contain serialized `ObjectRedirector` strings and alternate package-name leads. That supports a redirector hypothesis but does not replace a separately observed redirect-target relationship. The collector deliberately did not follow them. The actual `MWFormationAsset` registry class is now known, and the installed API declares it atline325425; a later narrowly justified export can address that gap. No new editor run is currently requested.

The222unresolved dependency references include external source/native packages; their existence does not mean222additional loads are necessary or safe. Review them against concrete research questions. DLC/mission assets outside the reviewed list, native algorithms, actor state and dynamic assignment are not made complete by this batch.

## Operational observation and next analysis

The collector spent several minutes inside the load of `AmbushBehaviorComponent` after215entries. The editor log continued building meshes and compiling shaders during that interval, then collection advanced normally. This confirms that a relatively small source asset can pull in costly dependencies. Final cooperative health check recorded8,681,971,712bytes free disk,1,989,173,248bytes available physical memory and4,837,830,656bytes available commit. These are end-of-run observations, not continuing guarantees or a measurement of the collector's isolated resource use. Shader compilation may continue after text collection.

[First source findings](AI_EXPANDED_SOURCE_FIRST_LOOK.md) identify the controller default tree, a combat subtree shared by the general/ally roots, named configuration differences, five combat tactics and mission-order priority. Next trace runtime configuration/root assignment, key readers/writers, the native order lifecycle and human supersession. Analyze this completed evidence before requesting another broad collection.

No source hash changed. In-memory exports could still include unsaved editor contents; disk checks cannot exclude those. No game launch/control, runtime bridge, measured AI optimization, live tactical decision or training occurred. **Gameplay remains NOT_PERFORMED.**
