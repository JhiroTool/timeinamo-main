import { Image, StyleSheet, View } from 'react-native';

import { LoadingState } from './ui';

export function AppLoadingView() {
  return (
    <View style={styles.screen}>
      <Image
        accessibilityLabel="TimeInamo"
        resizeMode="cover"
        source={require('../../assets/images/TI LOGO.png')}
        style={styles.logo}
      />
      <LoadingState label="Preparing your local workspace…" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 88, height: 88, borderRadius: 22 },
});
