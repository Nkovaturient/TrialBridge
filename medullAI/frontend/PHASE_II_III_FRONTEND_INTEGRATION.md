# TrialBridge Phase II-III Frontend Integration

> UI defaults assume `PAYMENT_MODE=standard` / `NEXT_PUBLIC_PAYMENT_MODE=standard`. x402 mode adds `X402PaymentReceipt`, Funding nav, and chain widgets — see [medullAI/backbone/X402_PAYMENTS.md](../backbone/X402_PAYMENTS.md).

## Realtime logs:

| Step | Wall time | ~Minutes |
|------|-----------|----------|
| **Ingest CSV** | 4.2–4.5 min | **~4.3 min** (≈ **4 min 15 s–4 min 30 s**) |
| **Batch rank** (`/api/batch_match`) | 100 s | **~1.7 min** (≈ **1 min 40 s**) |

**End-to-end** (ingest + batch): about **4.5 + 1.7 ≈ 6.2 min** (~**6 min** total).


## Priority Order                                                                                              

**Status: COMPLETE** (All P0/P1/P2 items implemented) ✅
                                                                                                                                        
### P0                                                                                                        
1. Confidence badges (high/medium/low) in ResultPanel                                                                                   
2. "Requires Investigator Review" warnings                                                                                              
3. Risk factors display                                                                                                                 
4. Auto-detect mapper option                                                                                                            
5. Batch results confidence column                                                                                                      
                                                                                                                                        
### P1                                                                                                                      
6. Criteria breakdown (AI-scored vs review criteria)                                                                              
7. Data quality warnings                                                                                                                
8. Deduplication summary in ingest                                                                                                      
                                                                                                                                        
### P2                                                                                                                   
9. Evaluation dashboard                                                                                                                 
10. Data quality dashboard                                                                                                              
11. Confidence distribution charts

---

## Implemented Features

| Feature | Location | Status |
|---------|----------|--------|
| Confidence badges (high/medium/low) | `ResultPanel.tsx` | ✅ |
| "Requires Investigator Review" warnings | `ResultPanel.tsx` | ✅ |
| Risk factors display | `ResultPanel.tsx` | ✅ |
| Criteria breakdown (AI vs human) | `CriteriaBreakdown.tsx` | ✅ |
| Data quality panel | `DataQualityPanel.tsx` | ✅ |
| Auto-detect mapper option | `match/page.tsx` | ✅ |
| Batch results confidence column | `match/page.tsx` | ✅ |
| Confidence distribution charts | `match/page.tsx` | ✅ |
| Deduplication summary | `quality/page.tsx` | ✅ |
| Data quality dashboard | `quality/page.tsx` | ✅ |
| Evaluation dashboard | `evaluation/page.tsx` | ✅ |
| Evaluation API route | `api/evaluation/route.ts` | ✅ |

---

## File Structure

```
app/(dashboard)/
  match/page.tsx          # Batch confidence charts + auto-detect UI
  quality/page.tsx          # Data quality dashboard
  evaluation/page.tsx       # Benchmark metrics display

app/api/evaluation/
  route.ts                  # Proxy to backbone evaluation endpoint

components/
  ResultPanel.tsx           # Confidence badges, risk factors, disclaimer
  CriteriaBreakdown.tsx     # AI vs human criteria classification
  DataQualityPanel.tsx      # Completeness bar + warnings

lib/types.ts                # MatchResult, BatchMatchStats with Phase II-III fields
```

---

## Demo Flow

1. **Upload CSV** → Auto-detect shows format + confidence; deduplication summary displayed
2. **Batch Match** → Confidence distribution chart rendered; rows flagged for review marked with ⚠
3. **Single Match Result** → Confidence badge + risk factors + criteria breakdown + data quality panel
4. **Quality Dashboard** → Full data quality report with completeness metrics
5. **Evaluation Dashboard** → Accuracy, precision, recall, FPR/FNR metrics
