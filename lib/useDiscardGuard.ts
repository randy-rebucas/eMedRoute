import { Alert } from 'react-native';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { t } from './i18n';

/**
 * Back, a swipe or a tab tap shouldn't silently drop typed changes. While `active`, leaving the
 * screen asks first. Turn it off while saving: the screen leaves on its own after a save.
 */
export function useDiscardGuard(active: boolean): void {
  const navigation = useNavigation();
  usePreventRemove(active, ({ data }) => {
    Alert.alert(t('common.discard.title'), t('common.discard.body'), [
      { text: t('common.discard.keepEditing'), style: 'cancel' },
      { text: t('common.discard.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
}
