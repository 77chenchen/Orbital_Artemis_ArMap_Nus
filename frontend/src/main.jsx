import { AppRegistry } from "react-native";
import App from "./App.jsx";
import "./styles.css";

AppRegistry.registerComponent("Atlas", () => App);

AppRegistry.runApplication("Atlas", {
  rootTag: document.getElementById("root"),
});
