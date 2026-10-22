import { STAFF_ROLES, mountWithAuth } from '../guard'
import { PlanificacionPage } from '../pages/PlanificacionPage'

mountWithAuth(STAFF_ROLES, <PlanificacionPage />)
