# Treemap SSE Integration Specification

## Overview
Frontend treemap component is ready to consume SSE data from `index_contrib_sector` event.

**Status: ✅ Backend Implementation Complete**

## Backend Implementation Summary

### Data Flow
1. `IndexContributionEngine` maintains symbol state with sector, weight, and contribution_points
2. `IndexContributionRunner.publish_sector_aggregate()` groups symbols by sector
3. Data is written to Redis in treemap format
4. `fetch_index_contrib_sector_latest()` reads from Redis
5. SSE endpoint pushes to frontend via `index_contrib_sector` event

### Modified Files
- ✅ `apps/backend/app/index_contribution/runner.py` - Generate treemap structure
- ✅ `apps/backend/app/services/serving_store.py` - Support new format (backward compatible)
- ✅ `apps/backend/tests/test_index_contribution_runner.py` - Verify treemap structure
- ✅ `apps/backend/tests/test_serving_store.py` - Test new format
- ✅ `apps/frontend/src/features/realtime/schemas/serving-event.schema.ts` - Updated schema
- ✅ `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.tsx` - Consume SSE data

## Backend SSE Event Structure

### Event Name
`index_contrib_sector`

### Data Schema
```json
{
  "index_code": "TSE01",
  "trade_date": "2026-04-14",
  "sectors": [
    {
      "name": "semiconductor",
      "children": [
        {
          "name": "2330",
          "size": 34.5,
          "contribution_points": 5.42
        },
        {
          "name": "2454",
          "size": 5.2,
          "contribution_points": 2.61
        }
      ]
    },
    {
      "name": "financial",
      "children": [
        {
          "name": "2881",
          "size": 7.8,
          "contribution_points": 1.24
        }
      ]
    }
  ],
  "ts": 1713098400000
}
```

## Field Descriptions

### Root Level
- `index_code`: Index identifier (e.g., "TSE01")
- `trade_date`: Trading date in ISO format (e.g., "2026-04-14")
- `sectors`: Array of sector groups
- `ts`: Unix timestamp in milliseconds

### Sector Group
- `name`: Sector name from `IndexContributionSnapshot1mModel.sector` field
- `children`: Array of symbols in this sector

### Symbol Item
- `name`: Stock symbol (from `symbol` field)
- `size`: Weight in index as percentage (e.g., 34.5 = 34.5%)
- `contribution_points`: Contribution to index points (can be positive or negative)

## Implementation Details

### Backend Code
The `publish_sector_aggregate` method in `IndexContributionRunner`:
```python
def publish_sector_aggregate(self, *, trade_date: date) -> None:
    """Publish sector treemap data with symbol details."""
    # Build treemap structure: group symbols by sector
    sectors_dict: dict[str, list[dict[str, Any]]] = {}
    for symbol_data in self.engine.symbol_state.values():
        sector = str(symbol_data.get("sector", "other"))
        if sector not in sectors_dict:
            sectors_dict[sector] = []
        
        sectors_dict[sector].append({
            "name": str(symbol_data["symbol"]),
            "size": float(symbol_data["weight"]) * 100,  # Convert to percentage
            "contribution_points": float(symbol_data["contribution_points"]),
        })
    
    # Convert to array format for frontend
    sectors = [
        {"name": sector_name, "children": children}
        for sector_name, children in sectors_dict.items()
    ]
    
    # Write to Redis
    payload = json.dumps(sectors, ensure_ascii=False)
    # ... (Redis write with retry logic)
```

### Data Source
- Source: `IndexContributionEngine.symbol_state`
- Each symbol contains: `symbol`, `sector`, `weight`, `contribution_points`
- Grouping: By `sector` field
- Weight conversion: `weight * 100` (0.345 → 34.5%)

## Frontend Integration Status

✅ Schema updated: `IndexContributionSectorSchema`
✅ Store ready: `indexContribSector` in realtime store
✅ Component updated: `TreemapDemoPage` consumes SSE data with fallback to mock data
✅ Visual rendering: Treemap displays contribution points with color coding:
  - Positive values: Red (#ef4444)
  - Negative values: Green (#22c55e)
  - Zero: Gray (#94a3b8)

## Testing

### Backend Tests
```bash
# Test runner generates correct treemap structure
pytest tests/test_index_contribution_runner.py -k end_to_end

# Test serving store handles new format
pytest tests/test_serving_store.py::test_fetch_index_contrib_sector_latest_from_json
```

### Frontend Testing
Once backend is running with real data:
1. Start SSE connection
2. Navigate to `/treemap-demo` page
3. Verify treemap updates with real-time data
4. Verify contribution points display with correct colors
5. Verify top/bottom contributors panel shows ranking data

## Backward Compatibility

The `fetch_index_contrib_sector_latest()` function supports both:
- **New format** (array): Treemap structure with full symbol details
- **Old format** (dict): Simple sector-to-contribution mapping

This ensures no breaking changes during deployment.

