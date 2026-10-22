import { STAFF_ROLES, mountWithAuth } from '../guard'
import { NuevaSolicitudPage } from '../pages/NuevaSolicitudPage'

mountWithAuth(STAFF_ROLES, <NuevaSolicitudPage />)
