import { STAFF_ROLES, mountWithAuth } from '../guard'
import { AgendaPage } from '../pages/AgendaPage'

mountWithAuth(STAFF_ROLES, <AgendaPage />)