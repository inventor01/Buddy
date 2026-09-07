import { isArbitrageRequest, isBroadArbitrageScan, suppressOptionalClarification } from './base44/shared/clarification.ts';
import { extractArbitrageProfitTarget, arbitragePortfolioSummary, normalizeArbitrageCandidate } from './base44/shared/arbitrage.ts';
const exact = 'Everyday search and find arbritage opportunities for a minimum of 5k that i can make this week';
if (!isArbitrageRequest(exact)) throw new Error('exact prompt not recognized as arbitrage');
if (!isBroadArbitrageScan(exact)) throw new Error('exact prompt not recognized as broad arbitrage');
const target=extractArbitrageProfitTarget(exact);
if (target !== 5000) throw new Error('5k target parse failed: '+target);
for (const q of ['Which product category should I scan?', 'Which stores should I search?', 'Amazon or eBay?', 'What marketplaces should I use?']) {
 if (suppressOptionalClarification(exact,q)!=='') throw new Error('optional question not suppressed: '+q);
}
const sanitize=(v:any)=>String(v||'').startsWith('http')?String(v):'';
const make=(name:string,resale:number)=>normalizeArbitrageCandidate({item_name:name,retailer:'Target',marketplace:'eBay',buy_price:100,discount_amount:10,net_buy_cost:999,resale_price:resale,estimated_fees:15,buy_url:'https://www.target.com/p/item-'+name,resale_url:'https://www.ebay.com/itm/'+name},sanitize);
const a=make('a',180), b=make('b',220);
if(!a||!b) throw new Error('valid candidates rejected');
if(a.net_buy_cost!==90) throw new Error('net cost was trusted instead of recomputed');
const p=arbitragePortfolioSummary([{arbitrage:a},{arbitrage:b}],target);
if(p.verified_potential!==200 || p.gap!==4800) throw new Error('portfolio math failed '+JSON.stringify(p));
console.log('EXACT_5K_ARBITRAGE_INTENT_PASS',JSON.stringify(p));
