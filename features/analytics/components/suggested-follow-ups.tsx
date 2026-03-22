import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

export function SuggestedFollowUps({
  queries,
  onSelectQuery,
}: {
  queries: { text: string; icon: string }[];
  onSelectQuery: (query: string) => void;
}) {
  return (
    <View style={{ marginTop: 24, gap: 8 }}>
      <Text
        style={{
          color: "rgba(255, 255, 255, 0.6)",
          fontSize: 12,
          fontWeight: "600",
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Next Steps
      </Text>

      {queries.map((q, idx) => (
        <Pressable
          key={idx}
          onPress={() => onSelectQuery(q.text)}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: pressed ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.08)",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.15)",
          })}
        >
          <Image
            source={q.icon}
            style={{
              width: 16,
              height: 16,
              tintColor: "rgba(255, 255, 255, 0.5)",
            }}
          />
          <Text
            style={{
              flex: 1,
              color: "#fff",
              fontSize: 14,
              fontWeight: "500",
            }}
          >
            {q.text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
