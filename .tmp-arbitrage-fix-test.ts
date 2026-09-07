import { candidateDiscoveryScore, namedArbitrageRetailers, toFinding } from './base44/shared/arbitrageSearch.ts';
import { arbitragePortfolioSummary, extractArbitrageProfitTarget } from './base44/shared/arbitrage.ts';

const prompt = "Every day search Target, Ollie's, Kroger, Meijer, and TJ Maxx for arbitrage opportunities for 5k this week";
const stores = namedArbitrageRetailers(prompt);
for (const required of ['Target', "Ollie's", 'Kroger', 'Meijer', 'TJ Maxx']) if (!stores.includes(required)) throw new Error(`missing retailer ${required}`);
if (extractArbitrageProfitTarget(prompt) !== 5000) throw new Error('5k target parse failed');

const highScore = candidateDiscoveryScore({ item_name:'LEGO Star Wars Collector Set', category:'collectible', brand:'LEGO', identifier:'75382', buy_price:80, discount_amount:30 });
const groceryScore = candidateDiscoveryScore({ item_name:'Cereal 12oz', category:'grocery', brand:'Brand', identifier:'123', buy_price:5, discount_amount:1 });
if (!(highScore > groceryScore + 20)) throw new Error(`priority scoring weak high=${highScore} grocery=${groceryScore}`);

const strong = toFinding({
  item_name:'LEGO Star Wars Collector Set', retailer:'Target', marketplace:'eBay', category:'collectible', brand:'LEGO', identifier:'75382',
  buy_price:50, discount_amount:20, buy_url:'https://www.target.com/p/lego-star-wars-75382/-/A-123456', resale_price:100, estimated_fees:15,
  resale_url:'https://www.ebay.com/itm/123456789', match_confidence:0.9, demand_note:'3 recent sold listings visible'
}, 5000) as any;
if (!strong?.arbitrage) throw new Error('strong finding rejected');
if (strong.arbitrage.action_tier !== 'check_now') throw new Error(`expected check_now got ${strong.arbitrage.action_tier}`);
if (strong.arbitrage.actionability_score < 70) throw new Error('strong actionability score too low');

const weak = toFinding({
  item_name:'Cereal 12oz', retailer:'Kroger', marketplace:'eBay', category:'grocery', brand:'Brand', identifier:'123',
  buy_price:8, discount_amount:0, buy_url:'https://www.kroger.com/p/cereal/000123', resale_price:14, estimated_fees:3,
  resale_url:'https://www.ebay.com/itm/222222222', match_confidence:0.9
}, 5000) as any;
if (!weak?.arbitrage) throw new Error('weak positive spread unexpectedly rejected');
if (weak.arbitrage.action_tier !== 'low_priority') throw new Error(`expected low_priority got ${weak.arbitrage.action_tier}`);

const lead = toFinding({
  item_name:'Dyson Vacuum Model X', retailer:'TJ Maxx', category:'vacuum', brand:'Dyson', identifier:'DX-1', buy_price:199,
  buy_url:'https://tjmaxx.tjx.com/store/jump/product/Dyson-Vacuum-Model-X/1000999', resale_price:0, resale_url:'', match_confidence:0.45,
  missing_evidence:'Exact resale evidence still needed.'
}, 5000) as any;
if (!lead?.arbitrage_lead) throw new Error('one-sided lead was lost');

const summary = arbitragePortfolioSummary([strong, weak, lead], 5000) as any;
if (summary.check_now !== 1 || summary.low_priority !== 1 || summary.count !== 2) throw new Error(`tier summary wrong ${JSON.stringify(summary)}`);
if (!(summary.verified_potential > 0 && summary.gap < 5000)) throw new Error('portfolio math failed');
console.log('ACTIONABILITY_UNIT_PASS', JSON.stringify({stores, highScore, groceryScore, strong: strong.arbitrage.actionability_score, weak: weak.arbitrage.actionability_score, summary}));
