import { STAFF_ROLES, mountWithAuth } from '../guard'
import { PagosPage } from '../pages/PagosPage'

mountWithAuth(STAFF_ROLES, <PagosPage />)
