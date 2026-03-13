import { StyleSheet, Text, View } from 'react-native';
import { StaticAuraBackground } from '@/components/static-aura-background';

export default function SearchScreen() {
  return (
    <View style={styles.container}>
      <StaticAuraBackground />
      <Text style={styles.text}>Search</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 24, fontWeight: '600' },
});
