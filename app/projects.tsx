import { Image } from "expo-image";
import { useProjects } from "@/stores/projects-store";
import { ListGroup, Separator } from "heroui-native";
import { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { type Project } from "@/constants/projects";

const PROJECT_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#636366",
];

const PROJECT_ICONS = [
  "briefcase.fill",
  "book.fill",
  "figure.run",
  "paintbrush.fill",
  "house.fill",
  "moon.stars.fill",
  "heart.fill",
  "star.fill",
  "cart.fill",
  "music.note",
  "gamecontroller.fill",
  "laptopcomputer",
];

export default function ProjectsScreen() {
  const { projects, addProject, updateProject, removeProject } = useProjects();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(PROJECT_ICONS[0]);

  function openAdd() {
    setEditing(null);
    setName("");
    setSelectedColor(PROJECT_COLORS[0]);
    setSelectedIcon(PROJECT_ICONS[0]);
    setModalVisible(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setName(project.name);
    setSelectedColor(project.color);
    setSelectedIcon(project.icon);
    setModalVisible(true);
  }

  function save() {
    if (!name.trim()) return;
    if (editing) {
      updateProject(editing.id, {
        name: name.trim(),
        color: selectedColor,
        icon: selectedIcon,
      });
    } else {
      addProject({ name: name.trim(), color: selectedColor, icon: selectedIcon });
    }
    setModalVisible(false);
  }

  function remove(id: string) {
    Alert.alert("Delete Project", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeProject(id) },
    ]);
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-[#111113]"
        contentContainerClassName="px-5 pb-10"
      >
        <View className="flex-row items-center justify-between mt-8 mb-8">
          <Text className="text-white text-4xl font-bold">Projects</Text>
          <TouchableOpacity
            onPress={openAdd}
            className="bg-[#1c1c1e] w-10 h-10 rounded-full items-center justify-center"
          >
            <Image
              source="sf:plus"
              style={{ width: 16, height: 16 }}
              tintColor="#fff"
            />
          </TouchableOpacity>
        </View>

        {projects.length === 0 ? (
          <Text className="text-neutral-500 text-center mt-10">
            No projects yet. Tap + to add one.
          </Text>
        ) : (
          <ListGroup>
            {projects.map((project, index) => (
              <View key={project.id}>
                {index > 0 && <Separator className="mx-4" />}
                <ListGroup.Item onPress={() => openEdit(project)}>
                  <ListGroup.ItemPrefix>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: project.color,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Image
                        source={`sf:${project.icon}`}
                        style={{ width: 16, height: 16 }}
                        tintColor="#fff"
                      />
                    </View>
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle>{project.name}</ListGroup.ItemTitle>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix>
                    <TouchableOpacity
                      onPress={() => remove(project.id)}
                      className="p-2"
                    >
                      <Image
                        source="sf:trash"
                        style={{ width: 16, height: 16 }}
                        tintColor="#ef4444"
                      />
                    </TouchableOpacity>
                  </ListGroup.ItemSuffix>
                </ListGroup.Item>
              </View>
            ))}
          </ListGroup>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-[#111113] px-5 pt-6">
          <View className="flex-row items-center justify-between mb-8">
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text className="text-neutral-400 text-base">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-white text-base font-semibold">
              {editing ? "Edit Project" : "New Project"}
            </Text>
            <TouchableOpacity onPress={save}>
              <Text className="text-blue-500 text-base font-semibold">Save</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-2 ml-1">
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Project name"
            placeholderTextColor="#636366"
            autoFocus
            className="bg-[#1c1c1e] text-white px-4 py-3 rounded-xl text-base mb-6"
          />

          <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
            Color
          </Text>
          <View className="flex-row flex-wrap gap-3 mb-6">
            {PROJECT_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => setSelectedColor(color)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: color,
                  borderWidth: selectedColor === color ? 3 : 0,
                  borderColor: "#fff",
                }}
              />
            ))}
          </View>

          <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
            Icon
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {PROJECT_ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                onPress={() => setSelectedIcon(icon)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor:
                    selectedIcon === icon ? selectedColor : "#1c1c1e",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: selectedIcon === icon ? 2 : 0,
                  borderColor: "#fff",
                }}
              >
                <Image
                  source={`sf:${icon}`}
                  style={{ width: 20, height: 20 }}
                  tintColor={selectedIcon === icon ? "#fff" : "#636366"}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}
