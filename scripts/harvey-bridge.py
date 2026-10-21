"""Use only Harvey discovery/profile APIs; never invoke campaigns or mail."""
import asyncio
import json
import sqlite3
import sys
from pathlib import Path

checkout = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(checkout))
from harvey.config import load_config
from harvey.state import StateManager, DB_PATH

async def main():
    mode, city, limit = sys.argv[2], sys.argv[3], int(sys.argv[4])
    config = load_config(str(checkout / 'harvey.local.yaml'))
    if config.channels.email.enabled or config.channels.linkedin.enabled:
        raise RuntimeError('Disable email and LinkedIn channels before discovery.')
    state = StateManager()
    await state.init_db()
    if mode == 'discover':
        from harvey.collectors.discover import build_queries, PROVIDERS
        # Upstream OSM maps trades only; add explicit retail categories for Kirat.
        PROVIDERS['osm'].TAG_MAP = {'retail': ['shop=clothes', 'shop=shoes', 'shop=jewelry', 'shop=supermarket']}
        coordinates = {
            'New Delhi, India':'28.6139,77.2090,15', 'Noida, India':'28.5355,77.3910,10',
            'Gurugram, India':'28.4595,77.0266,10', 'Faridabad, India':'28.4089,77.3178,10',
            'Ghaziabad, India':'28.6692,77.4538,10', 'Greater Noida, India':'28.4744,77.5040,10'}
        if city not in coordinates:
            raise ValueError('Supported cities: ' + '; '.join(coordinates))
        config.icp.geo_coordinates[city] = coordinates[city]
        from harvey.signals import seed_signal_catalog
        await seed_signal_catalog(state)
        # The approved discovery-only setup enables free website/listing signals.
        for signal in await state.get_signal_codes():
            if signal['status'] == 'proposed' and signal['cost_note'].lower().startswith(('free', 'included')):
                await state.set_signal_status(signal['code'], 'confirmed')
        from harvey.pipeline import run_prospecting
        queries = build_queries(config, cities=[city], depth=20, limit=limit)
        report = await run_prospecting(state, config, 'osm', queries,
                                      max_spend=0, profile=True, profile_limit=limit)
        print(json.dumps(report.discover, indent=2))
        if report.errors or (report.discover or {}).get('stopped'):
            raise RuntimeError('; '.join(report.errors) or report.discover['stopped'])
    with sqlite3.connect(f'file:{DB_PATH}?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        companies = db.execute('SELECT * FROM companies ORDER BY created_at DESC LIMIT ?', (limit,)).fetchall()
        candidates = []
        for c in companies:
            observations = [dict(o) for o in db.execute(
                'SELECT signal_code,value_text,value_num,evidence_url,confidence,observed_at FROM observations WHERE company_id=?', (c['id'],))]
            candidates.append({'company': c['name'], 'website':c['website'], 'domain':c['domain'],
                               'location':c['location'], 'source_url':c['source_url'],
                               'observations':observations, 'qualified':False})
    print('KIRAT_CANDIDATES_JSON=' + json.dumps(candidates))

if __name__ == '__main__':
    asyncio.run(main())
