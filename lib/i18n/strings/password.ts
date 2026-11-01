import { defineStrings } from '../types';

// Area "password": app/(app)/change-password.tsx.
export default defineStrings({
  en: {
    intro: 'Changing your password signs you out on every other device.',
    current: 'Current password',
    currentRequired: 'Enter your current password.',
    wrongCurrent: 'That isn’t your current password.',
    new: 'New password',
    rules: 'At least {min} characters. Avoid common passwords and anything from your email.',
    tooShort: 'Use at least {min} characters.',
    confirm: 'Type the new password again',
    mismatch: 'The two passwords don’t match.',
    save: 'Change password',
    changed: 'Password changed. Your other devices are signed out.',
  },
  fil: {
    intro: 'Kapag pinalitan mo ang password, masa-sign out ka sa lahat ng iba mong device.',
    current: 'Kasalukuyang password',
    currentRequired: 'Ilagay ang kasalukuyang password mo.',
    wrongCurrent: 'Hindi iyan ang kasalukuyang password mo.',
    new: 'Bagong password',
    rules: 'Hindi bababa sa {min} na character. Iwasan ang karaniwang password at anumang galing sa email mo.',
    tooShort: 'Gumamit ng hindi bababa sa {min} na character.',
    confirm: 'I-type ulit ang bagong password',
    mismatch: 'Hindi magkapareho ang dalawang password.',
    save: 'Palitan ang password',
    changed: 'Napalitan na ang password. Na-sign out na ang iba mong device.',
  },
});
