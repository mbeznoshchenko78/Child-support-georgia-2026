/* Replays the display arithmetic shipped by the public Georgia calculator. The
 * public application bundle must be supplied locally, at the verified revision.
 * No network or account access is used. No vendor code is included in this file.
 * Usage: node official-reference.mjs <bundle-file> <fixture-inputs.json>
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const [bundlePath, inputsPath] = process.argv.slice(2);
if (!bundlePath || !inputsPath) throw new Error('Expected a local bundle and fixture inputs file.');
const bytes = readFileSync(bundlePath);
const digest = createHash('sha256').update(bytes).digest('hex');
if (digest !== '99ad24cf1793e45cbc67d4cff1859b4c7261955ffd867521ff171431a7e53303') {
  throw new Error('The public calculator revision has changed. Inspect it before refreshing references.');
}
const source = bytes.toString('utf8');
function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Missing expected marker ${start}`);
  return source.slice(from, to);
}
// These markers identify the published, client-side, synchronous worksheet routines
// within the pinned minified file. React, persistence, login and HTTP are omitted.
const prelude = [
  'const ' + section('IC=[{adjusted:', ',zC=()=>') + ';',
  'const ' + section('Wv=e=>e.reduce', ',zv=(e,t)=>') + ';',
  section('const pS=e=>', ';function jS(e)') + ';',
  'const np=()=>({t:value=>value});',
  'const Tm=()=>worksheet;',
].join('\n');
const calculation = section('kS=()=>{var e,t,n,r,i,o,a,s,l,d,c,u,h,p,m,f,_,g,x,v,b,y,w,j,C,S,k,A,N,E,D,P,O,I,T,M,F,R,L,B,W,$,z,Y,q,H,U,V,G,Q,K,J,X,Z,ee,te,ne,re,ie,oe;', ';return(0,ce.jsxs)(ce.Fragment');
const payment = section('(()=>{const e=ae.non_custodial_parent;if(null===e)', '})}),(0,ce.jsx)(ve,{sx:{pt:4}');
const code = prelude + '\nconst ' + calculation + `;
  return { adjusted:[se,le], percentages:[Ne,Ee], bcso:Pe, basicShares:[Oe,Ie],
    timeAdjustment:we, expenseShares:[Fe,Re], adjustedObligation:[Le,Be], expensePaid:[We,$e],
    presumptive:[ze,Ye], lowIncome:[Ue,Ve], deviations:[Ge,Qe], subtotal:[Ke,Je],
    afterBenefits:[nt,rt], finalWhole:[Math.round(nt),Math.round(rt)], summary:${payment} };
}; kS();`;
const compiled = new vm.Script(code);

function form(input) {
  const [grossA, grossB] = input.gross;
  const names = ['Parent A','Parent B'];
  const [seA,seB] = input.selfEmployment ?? [0,0];
  const [priorA,priorB] = input.priorSupport ?? [0,0];
  const [qualifiedA,qualifiedB] = input.qualified ?? [0,0];
  const prior = [{preexisting_child_support_paid_monthly1:priorA,preexisting_child_support_paid_monthly2:priorB}];
  const qualified = [qualifiedA,qualifiedB].flatMap((count,index) => Array.from({length:count}, () => ({adjustment_requested_by:names[index]})));
  const [healthA,healthB] = input.monthlyHealth ?? [0,0];
  const [careA,careB] = input.monthlyChildcare ?? [0,0];
  const [educationA,educationB] = input.monthlyEducation ?? [0,0];
  const [medicalA,medicalB] = input.monthlyExtraMedical ?? [0,0];
  const [specialA,specialB] = input.monthlySpecial ?? [0,0];
  const [ssA,ssB] = input.dependentSocialSecurity ?? [0,0];
  const [vaA,vaB] = input.dependentVeterans ?? [0,0];
  const [flatA,flatB] = input.flatDeviation ?? [0,0];
  const days = input.ncpDays ?? 0;
  const a = {total_gross_income1:grossA,total_gross_income2:grossB};
  const b = {monthly_self_employment_income1:seA,monthly_self_employment_income2:seB,
    preexisting_child_support_amount1:priorA,preexisting_child_support_amount2:priorB,
    pre_existing_child_support:prior,proposed_adjustment_for_qualified_child:qualified};
  const c = {schedule_c_non_custodial_parenting_days:days,schedule_c_custodial_parenting_days:365-days};
  const d = {health_insurance_premiums_parent1:healthA*12,health_insurance_premiums_parent2:healthB*12,health_insurance_premiums_parent3:0,
    monthly_total1:careA,monthly_total2:careB,monthly_total3:0};
  const e = {proposed_low_income_deviation:[],judicial_discretion_for_low_income:[],
    specific_nonspecific_deviation:[flatA,flatB].flatMap((amount,i)=>amount?[{deviation_is_for:names[i],proposed_deviation_amount:amount}]:[]),
    extraordinary_educational_expenses_total1:educationA*12,extraordinary_educational_expenses_total2:educationB*12,extraordinary_educational_expenses_total3:0,
    extraordinary_medical_expenses_total1:medicalA*12,extraordinary_medical_expenses_total2:medicalB*12,extraordinary_medical_expenses_total3:0,
    special_expenses_child_rearing_total1:specialA*12,special_expenses_child_rearing_total2:specialB*12,special_expenses_child_rearing_total3:0,
    parenting_time_deviation1:0,parenting_time_deviation2:0};
  return {parent_name_1:names[0],parent_name_2:names[1],non_custodial_parent:names[input.ncp ?? 1],
    created_at:'2026-11-24T12:00:00Z',add_child_to_worksheet:Array.from({length:input.children},()=>({child_status:'included'})),
    ...a,...b,...c,...d,gross_income_schedule_a:a,adjusted_income_schedule_b:b,parenting_time_schedule_c:c,
    health_insurance_child_care_schedule_d:d,deviations_schedule_e:e,social_security_payment_1:ssA,social_security_payment_2:ssB,
    veterans_affairs_disability_payment_1:vaA,veterans_affairs_disability_payment_2:vaB};
}
const cases=JSON.parse(readFileSync(inputsPath,'utf8'));
function formatted(value){
  if(Array.isArray(value)) return value.map(formatted);
  if(value!=='' && typeof value!=='boolean' && Number.isFinite(Number(value))) return Number(Number(value).toFixed(2));
  return value;
}
const result = cases.map(input => {
  const context=vm.createContext({worksheet:form(input)},{codeGeneration:{strings:false,wasm:false}});
  const raw=compiled.runInContext(context,{timeout:1000});
  const lines=Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,formatted(value)]));
  return {input,lines};
});
console.log(JSON.stringify(result,null,2));
