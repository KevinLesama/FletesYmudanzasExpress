import { STAFF_ROLES, mountWithAuth } from '../guard'
import { ChoferConfigPage } from '../pages/ChoferConfigPage'

mountWithAuth(STAFF_ROLES, <ChoferConfigPage />)
