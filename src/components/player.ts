// Nombre con el que la tripulación se dirige al jugador: el que escribió al empezar o "Comandante".
import { t } from '../i18n';
import { commanderName } from '../state/store';

export const playerName = (): string => commanderName.value.trim() || t('crew.commander_default');
