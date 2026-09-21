// Bounded diagnostic above the acceptance deadline; never changes the 4s policy.
import { createLocalLanguageModel } from '../companion/local-language-model.mjs';
import profiles from '../companion/personas.json' with { type:'json' };
import { writeFile } from 'node:fs/promises';
const model = createLocalLanguageModel(), samples=[];
let error=null;
try {
  await model.start();
  for (const persona of profiles.profiles) {
    const started=performance.now();
    try {
      const text=await model.generate({persona,request:{text:'Radio check. Give a brief greeting in eight words or fewer.'},facts:[],history:[]},
        {signal:AbortSignal.timeout(10000)});
      samples.push({persona:persona.id,text,completeTextMs:Math.round(performance.now()-started)});
    } catch(e) { samples.push({persona:persona.id,error:e.message,elapsedMs:Math.round(performance.now()-started)}); }
  }
} catch(e) { error=e.message; }
finally {
  const beforeStop=model.status(); await model.stop();
  const result={recordedAt:new Date().toISOString(),classification:'LOCAL_COMPONENT_TIMING_DIAGNOSTIC',
    diagnosticTimeoutMs:10000,acceptanceTargetMs:4000,acceptance:'NOT_ESTABLISHED',samples,error,
    model:beforeStop,shutdown:model.status(),gameTests:'NOT_PERFORMED',speechTests:'NOT_PERFORMED'};
  await writeFile(new URL('../research/CONVERSATION_LATENCY_DIAGNOSTIC.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({samples,error,shutdown:model.status().state}));
}
