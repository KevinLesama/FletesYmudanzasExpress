import { STAFF_ROLES, mountWithAuth } from '../guard'
import { SolicitudesPage } from '../pages/SolicitudesPage'

mountWithAuth(STAFF_ROLES, <SolicitudesPage />)
