import { STAFF_ROLES, mountWithAuth } from '../guard'
import { FlotaPage } from '../pages/FlotaPage'

mountWithAuth(STAFF_ROLES, <FlotaPage />)
