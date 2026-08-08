import { MONTHS, isSameDay } from "@/features/timeline/timeline-utils";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildMonthGrid(monthAnchor: Date): (Date | null)[] {
  const first = startOfMonth(monthAnchor);
  const firstWeekday = (first.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(
    monthAnchor.getFullYear(),
    monthAnchor.getMonth() + 1,
    0,
  ).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(
      new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), day),
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePickerSheet({
  selectedDate,
  onSelect,
}: {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [monthAnchor, setMonthAnchor] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );

  const weeks = useMemo(() => {
    const cells = buildMonthGrid(monthAnchor);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [monthAnchor]);

  function changeMonth(delta: number) {
    setMonthAnchor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  return (
    <View className="px-5 pt-2 pb-4">
      <View className="flex-row items-center justify-between pb-4">
        <Pressable
          className="w-9 h-9 items-center justify-center"
          onPress={() => changeMonth(-1)}
          hitSlop={8}
        >
          <Text className="text-zinc-400 text-lg">‹</Text>
        </Pressable>
        <Text className="text-white text-base font-semibold">
          {MONTHS[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}
        </Text>
        <Pressable
          className="w-9 h-9 items-center justify-center"
          onPress={() => changeMonth(1)}
          hitSlop={8}
        >
          <Text className="text-zinc-400 text-lg">›</Text>
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <View key={i} className="flex-1 items-center pb-2">
            <Text className="text-zinc-600 text-xs font-medium">{letter}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} className="flex-row">
          {week.map((day, di) => {
            if (!day) return <View key={di} className="flex-1 aspect-square" />;
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDate);
            return (
              <View
                key={di}
                className="flex-1 aspect-square items-center justify-center"
              >
                <Pressable
                  onPress={() => onSelect(day)}
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    isSelected ? "bg-white" : ""
                  }`}
                >
                  <Text
                    className={`text-base font-medium ${
                      isSelected
                        ? "text-black"
                        : isToday
                          ? "text-white"
                          : "text-zinc-400"
                    }`}
                  >
                    {day.getDate()}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}

      <Pressable className="items-center pt-3" onPress={() => onSelect(today)}>
        <Text className="text-zinc-400 text-sm font-medium">Today</Text>
      </Pressable>
    </View>
  );
}
