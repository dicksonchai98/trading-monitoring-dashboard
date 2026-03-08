## 1. Shared Shioaji Session Factory

- [x] 1.1 Create shared session module (e.g., `app/services/shioaji_session.py`) with `build_shioaji_api()` and `build_shioaji_client()`
- [x] 1.2 Ensure factory uses `SHIOAJI_API_KEY`, `SHIOAJI_SECRET_KEY`, and `SHIOAJI_SIMULATION` from config
- [x] 1.3 Add minimal unit coverage for factory behavior (builds client with configured credentials)

## 2. Market Ingestion Alignment

- [x] 2.1 Update `build_ingestor_runner()` to use the shared Shioaji session factory
- [x] 2.2 Remove any duplicated session construction in ingestion (if present after refactor)
- [x] 2.3 Verify ingestion login flow remains `login -> fetch_contracts -> subscribe`

## 3. Documentation Alignment

- [x] 3.1 Update backfill job design to reference the shared Shioaji session factory (if not already updated)
- [x] 3.2 Document where the shared factory lives for future backfill usage
