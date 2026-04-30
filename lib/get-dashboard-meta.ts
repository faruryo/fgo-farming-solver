import { DashboardMeta } from './master-data/update'
import { fetchData } from './data-source'

const DASHBOARD_META_KEY = 'dashboard_meta'
const MOCK_PATH = 'mocks/dashboard.json'

export const getDashboardMeta = async (): Promise<DashboardMeta | null> => {
  return fetchData<DashboardMeta>(DASHBOARD_META_KEY, MOCK_PATH)
}
