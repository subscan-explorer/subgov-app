import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {act,create} from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const env={app:{},chain:{},calls:[],navigation:[],walletOpens:0,votingReads:[],delegatorReads:[],chainReads:[]};
globalThis[Symbol.for('subgov.interactionTest')]=env;
env.context={votable:100000000000n,trackLock:0n,existing:null,delegating:null};
env.submit=(args)=>new Promise((resolve,reject)=>{env.calls.push({args,resolve,reject});args.onProgress?.('Connecting to network');});
const root=new URL('../src/',import.meta.url);
const prefix="const e=globalThis[Symbol.for('subgov.interactionTest')];";
const ui="import React from 'react'; const wrap=(tag)=>(p)=>React.createElement(tag,p,p.children); "+['Button:button','TextButton:button','IconButton:button','Input:input','Select:select','Checkbox:input','Textarea:textarea','Panel:div','Badge:span','ModuleHeader:header','PageHeader:header','Field:label','ChoiceButton:button','ChoiceGroup:div','ArrowLink:a','MetaList:dl','MetaItem:dd','StatusBadge:span','RecordRow:div','TrackBadge:span'].map(s=>{let[n,t]=s.split(':');return `export const ${n}=wrap('${t}');`;}).join('');
const mocks={
 '@/components/app-state':`${prefix} export const useApp=()=>e.app;`,
 '@/components/ui':ui,
 '@/components/modal':"import React from 'react'; export const Modal=({children})=>React.createElement('section',{'data-modal':true},children);",
 '@/components/wallet-extras':'export const ProxyNote=()=>null;',
 '@/hooks/use-chain-href':`${prefix} export const useChain=()=>e.chain; export const useChainFromUrl=()=>e.chain.id; export const useChainHref=()=>((p,x)=>p+'?'+new URLSearchParams({chain:e.chain.id,...Object.fromEntries(Object.entries(x??{}).filter(([,v])=>v!==undefined))}));`,
 '@/lib/vote':`${prefix} export * from ${JSON.stringify(new URL('lib/vote.ts',root).href)}; export const submitGovernanceTransaction=e.submit; export const submitReferendumVote=e.submit; export const submitDelegation=e.submit; export const submitUndelegation=e.submit; export const readAccountDelegations=async()=>[]; export const readVotingContext=async()=>e.context;`,
 '@/lib/chain-api':`${prefix} export const preconnectChainApi=()=>{}; export const getChainApi=(...args)=>new Promise((resolve,reject)=>e.chainReads.push({args,resolve,reject}));`,
 '@/lib/account-chain':`${prefix} export const readAccountVoting=(args)=>new Promise((resolve,reject)=>e.votingReads.push({args,resolve,reject}));`,
 '@/lib/gov-actions':`${prefix} export const referendumBriefs=async()=>[]; export const receivedDelegations=(...args)=>new Promise((resolve,reject)=>e.delegatorReads.push({args,resolve,reject}));`,
 '@/components/preimage-actions':'export const PreimageDecode=()=>null;',
 '@/lib/governance-sync':'export const notifyGovernanceChanged=()=>{};',
 '@/lib/proposal':`${prefix} export const getProposalCapabilities=async()=>e.capabilities; export const prepareProposal=(...args)=>new Promise((resolve,reject)=>e.previews.push({args,resolve,reject})); export const submitProposal=e.submit;`,
 'next/link':"import React from 'react';export default (p)=>React.createElement('a',p,p.children);",
 'next/navigation':`${prefix} export const useRouter=()=>({push:(...a)=>e.navigation.push(a)});`,
};
const loader=registerHooks({
 resolve(s,c,next){if(mocks[s])return{url:'data:text/javascript,'+encodeURIComponent(mocks[s]),shortCircuit:true}; if(s.startsWith('@/')){const base=new URL(s.slice(2),root);return next(base.href+(['.tsx','.ts','/index.ts','/index.tsx'].find(ext=>existsSync(new URL(base.href+ext)))??'.ts'),c);} if(c.parentURL?.startsWith(root.href)&&s.startsWith('.')&&!/\.[cm]?[jt]sx?$/.test(s)){const base=new URL(s,c.parentURL);return next(base.href+(['.tsx','.ts','/index.ts','/index.tsx'].find(ext=>existsSync(new URL(base.href+ext)))??'.ts'),c);}return next(s,c.parentURL?.startsWith('data:')?{...c,parentURL:import.meta.url}:c);},
 load(url,c,next){if(url.endsWith('.tsx'))return{format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText};return next(url,c);}
});
env.previews=[]; env.capabilities={runtime:{specName:'fixture',specVersion:1},assets:[],origins:[{value:'small_tipper',label:'Small Tipper',trackId:30,minEnactmentBlocks:10}],templates:Object.fromEntries(['treasury','usdx-treasury','batch-treasury','multi-asset-bounty','remark','cancel','kill','new-preimage','existing-preimage'].map(x=>[x,{enabled:true,allowedOrigins:['small_tipper']}]))};
const {VoteDialog}=await import('../src/components/gov.tsx');
const {DelegateDialog}=await import('../src/components/delegate-dialog.tsx');
const {UndelegateDialog}=await import('../src/components/undelegate.tsx');
const {default:NewProposalPage}=await import('../src/app/referenda/new/page.tsx');
const {TxDialog}=await import('../src/components/tx-dialog.tsx');
const {ReferendaBrowser}=await import('../src/components/referenda-browser.tsx');
const {ReferendumJump}=await import('../src/components/referendum-jump.tsx');
const {ListPagination}=await import('../src/components/list-pagination.tsx');
const {useAccountVoting}=await import('../src/components/account-votes.tsx');
const {ReceivedDelegations}=await import('../src/components/received-delegations.tsx');
const {WhitelistList}=await import('../src/components/whitelist-list.tsx');
loader.deregister();
const {governanceChains}=await import('../src/lib/chains.ts');
env.chain=governanceChains.paseo;
const signer={signPayload:async()=>({signature:'test'})};
const app=()=>({account:'account-A',signerAccount:'account-A',signer,walletSource:'subwallet-js',readOnly:false,openWalletDialog:()=>env.walletOpens++});
env.app=app();
const event={preventDefault(){}};
let renderer,pending;
const mount=async(Component,props)=>{await act(async()=>{renderer=create(React.createElement(Component,props));});};
const unmount=async()=>{await act(async()=>{renderer.unmount();});};
const buttons=()=>renderer.root.findAllByType('button');
const button=(text)=>buttons().find(x=>x.children.join('')===text);
const text=()=>JSON.stringify(renderer.toJSON());
const props={chain:env.chain,title:'Refund fixture',triggerLabel:'Refund',successText:'Refund complete',build:()=>({})};
await mount(TxDialog,props);
await act(async()=>button('Refund').props.onClick());
const submit=renderer.root.findByType('form').props.onSubmit;
await act(async()=>{pending=Promise.all([submit(event),submit(event)]);});
assert.equal(env.calls.length,1,'double submission before React renders must invoke the signer once');
await act(async()=>{env.calls[0].reject(new Error('User rejected signature'));await pending;});
assert(text().includes('User rejected signature'));
assert(!text().includes('Refund complete'));
await act(async()=>{pending=renderer.root.findByType('form').props.onSubmit(event);});
const call=env.calls.at(-1);
for(const progress of ['Awaiting wallet signature','Broadcasting','In block · waiting for finality']){await act(async()=>call.args.onProgress(progress));assert(text().includes(progress));assert(!text().includes('Refund complete'));}
await act(async()=>{env.app={...app(),account:'account-B',signerAccount:'account-B'};renderer.update(React.createElement(TxDialog,props));});
assert.equal(renderer.root.findAllByType('form').length,0,'switching account must dismiss the previous transaction form');
await act(async()=>{call.args.onProgress('Finalized');call.resolve({txHash:'old-account-hash',blockHash:'old-block'});await pending;});
assert(!text().includes('old-account-hash'),'late old-account receipt must not appear on the new account');
await unmount();
env.app={...app(),readOnly:true};await mount(TxDialog,props);assert.equal(button('Refund').props.disabled,true);await unmount();
env.app={...app(),walletSource:'wallet-connect',walletConnectGenesisHash:'0xwrong'};await mount(TxDialog,props);await act(async()=>button('Refund').props.onClick());assert.equal(env.walletOpens,1);assert.equal(renderer.root.findAllByType('form').length,0);await unmount();
env.app=app();await mount(TxDialog,{...props,chain:governanceChains.polkadot});await act(async()=>button('Refund').props.onClick());let before=env.calls.length;await act(async()=>renderer.root.findByType('form').props.onSubmit(event));assert.equal(env.calls.length,before,'mainnet consent is checked in the handler');await unmount();

for(const Component of [ReferendumJump,ReferendaBrowser]){
 await mount(Component,Component===ReferendaBrowser?{filters:[{key:'all',label:'All'},{key:'active',label:'Active'}],status:'all',tracks:[{id:30,label:'Tipper'}],track:null}:{});
 for(const value of ['-1','1.5','nope','9007199254740993','9'.repeat(320)]){
  await act(async()=>renderer.root.findByType('input').props.onChange({target:{value}}));before=env.navigation.length;await act(async()=>renderer.root.findByType('form').props.onSubmit(event));assert.equal(env.navigation.length,before,`invalid referendum number ${value.slice(0,20)} must not navigate`);
 }
 await act(async()=>renderer.root.findByType('input').props.onChange({target:{value:'#160'}}));await act(async()=>renderer.root.findByType('form').props.onSubmit(event));assert.equal(env.navigation.at(-1)[0],'/referenda/160/?chain=paseo');await unmount();
}
for(const page of [0,14,30]){await mount(ListPagination,{path:'/referenda/',network:'paseo',page,totalPages:31,extra:{status:'active',track:30}});const links=renderer.root.findAllByType('a');assert.equal(links.filter(x=>x.props['aria-current']==='page').length,1);for(const link of links){const url=new URL(link.props.href,'https://example.test');assert.equal(url.searchParams.get('chain'),'paseo');assert.equal(url.searchParams.get('track'),'30');assert.equal(url.searchParams.get('status'),'active');}await unmount();}
for(const [Component,componentProps,trigger] of [
 [VoteDialog,{referendum:{id:160,trackId:30,status:'Deciding'}},'Vote'],
 [DelegateDialog,{target:'test-target',tracks:[{id:30,name:'small_tipper'}]},'Delegate'],
 [UndelegateDialog,{chain:env.chain,delegations:[{trackId:30,trackName:'Tipper',balance:10000000000n,conviction:'None',target:'test-target'},{trackId:31,trackName:'Big Tipper',balance:5000000000n,conviction:'None',target:'test-target'}],triggerLabel:'Undelegate'},'Undelegate'],
]){
 env.app=app();await mount(Component,componentProps);
 await act(async()=>button(trigger).props.onClick());
 const input=renderer.root.findAllByType('input').find(x=>x.props.name==='amount');
 if(input)await act(async()=>input.props.onChange({target:{value:'1'}}));
 before=env.calls.length;const handler=renderer.root.findByType('form').props.onSubmit;
 await act(async()=>{pending=Promise.all([handler(event),handler(event)]);});
 assert.equal(env.calls.length,before+1,`${trigger} must prevent duplicate signing`);
 if(trigger==='Undelegate'){assert.deepEqual(env.calls.at(-1).args.trackIds,[30,31]);assert(text().includes('Big Tipper'));}
 await act(async()=>{env.calls.at(-1).reject(new Error('Rejected fixture'));await pending;});
 assert(text().includes('Rejected fixture'));
 await act(async()=>{pending=renderer.root.findByType('form').props.onSubmit(event);});
 assert.equal(env.calls.length,before+2,`${trigger} must allow retry after rejection`);
 const delayed=env.calls.at(-1);
 await act(async()=>{env.app={...app(),account:'account-B',signerAccount:'account-B'};renderer.update(React.createElement(Component,componentProps));});
 assert.equal(renderer.root.findAllByType('form').length,0,`${trigger} must reset after account switch`);
 await act(async()=>{delayed.args.onProgress('Finalized');delayed.resolve({txHash:'old-scope-hash',blockHash:'old-block'});await pending;});
 assert(!text().includes('old-scope-hash'));await unmount();
}
env.app=app();await mount(NewProposalPage,{});
let handler=renderer.root.findByType('form').props.onSubmit;
await act(async()=>{pending=Promise.all([handler(event),handler(event)]);});
assert.equal(env.previews.length,1,'proposal preview must prevent duplicate requests');
await act(async()=>{env.previews[0].resolve({method:'treasury.spendLocal',callHash:'fixture-hash',callHex:'0x00',callLength:2,preimageExists:false});await pending;});
assert(text().includes('Review encoded call'));
before=env.calls.length;handler=renderer.root.findByType('form').props.onSubmit;
await act(async()=>{pending=Promise.all([handler(event),handler(event)]);});
assert.equal(env.calls.length,before+1,'proposal must prevent duplicate signing');
const proposalCall=env.calls.at(-1);
await act(async()=>{env.chain=governanceChains.kusama;renderer.update(React.createElement(NewProposalPage));});
await act(async()=>{proposalCall.resolve({txHash:'old-network-hash',blockHash:'old-block',referendumIndex:160});await pending;});
assert(!text().includes('old-network-hash'),'late proposal receipt must not cross networks');await unmount();
console.log('interaction checks passed: transaction race/rejection/scope, signing gates, jump validation and pagination');

// Real read components with deferred RPC/index responses: a new scope must never show old data.
env.chain=governanceChains.paseo;
let probe;
function VotingProbe({chain,address}) { probe=useAccountVoting(chain,address); return React.createElement('p',null,probe.snapshot?.marker ?? probe.error ?? 'loading'); }
await mount(VotingProbe,{chain:env.chain,address:'A'});
await act(async()=>env.votingReads.at(-1).resolve({marker:'account-A'}));assert(text().includes('account-A'));
await act(async()=>renderer.update(React.createElement(VotingProbe,{chain:env.chain,address:'B'})));
assert(!text().includes('account-A'));const oldRead=env.votingReads.at(-1);
await act(async()=>renderer.update(React.createElement(VotingProbe,{chain:env.chain,address:'C'})));
await act(async()=>oldRead.resolve({marker:'late-B'}));assert(!text().includes('late-B'));
await act(async()=>env.votingReads.at(-1).reject(new Error('RPC unavailable')));assert(text().includes('RPC unavailable'));
await act(async()=>probe.reload());assert(!text().includes('RPC unavailable'));
await act(async()=>env.votingReads.at(-1).resolve({marker:'recovered-C'}));assert(text().includes('recovered-C'));
await act(async()=>renderer.update(React.createElement(VotingProbe,{chain:env.chain,address:null})));
assert(!text().includes('recovered-C'));assert.equal(probe.snapshot,null);await unmount();
await mount(ReceivedDelegations,{chain:env.chain,address:'A'});
await act(async()=>{env.votingReads.at(-1).resolve({tracks:[{trackId:30,trackName:'Tipper',received:{votes:1000000000n,capital:10000000000n}}]});env.delegatorReads.at(-1).resolve({rows:[{address:'delegator-A',display:'Only account A',amount:'10000000000',trackId:30}]});});
assert(text().includes('Only account A'));assert(text().includes('1 PAS'));
await act(async()=>renderer.update(React.createElement(ReceivedDelegations,{chain:env.chain,address:'B'})));
assert(!text().includes('Only account A'));assert(!text().includes('1 PAS'));
await act(async()=>{env.votingReads.at(-1).resolve({tracks:[]});env.delegatorReads.at(-1).reject(new Error('Index unavailable'));});
assert(text().includes('Nobody delegates'));assert(text().includes('Delegators could not be loaded'));await unmount();
const hash='0x'+'ab'.repeat(32);
await mount(WhitelistList,{});
await act(async()=>env.chainReads.at(-1).resolve({query:{whitelist:{whitelistedCall:{keys:async()=>[{args:[{toHex:()=>hash}]}]}}}}));
assert(text().includes(hash));
await act(async()=>{env.chain=governanceChains.kusama;renderer.update(React.createElement(WhitelistList));});assert(!text().includes(hash));
await act(async()=>env.chainReads.at(-1).reject(new Error('RPC disconnected')));assert(text().includes('Data unavailable'));assert(!text().includes('Nothing whitelisted'));
await act(async()=>{env.chain=governanceChains.paseo;renderer.update(React.createElement(WhitelistList));});
await act(async()=>env.chainReads.at(-1).resolve({query:{whitelist:{whitelistedCall:{keys:async()=>[]}}}}));assert(text().includes('Nothing whitelisted'));await unmount();
console.log('read scope checks passed: profile changes, late responses, RPC recovery, empty vs failed reads');
