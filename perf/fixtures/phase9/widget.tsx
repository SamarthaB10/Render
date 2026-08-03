import { Box, Button, Grid, Icon, List, Progress, Text, YouTubePlayer, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "Phase 9 Interactive Fixture",
  "sdkVersion": "0.1.0",
  "size": { "width": 520, "height": 360 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": ["network"],
  "subscribe": []
}, () => (
  <Box style={{ backgroundColor: "#111827", padding: 12, radius: 10 }}>
    <Grid columns={2} style={{ gap: 8 }}>
      <Icon name="bolt.fill" />
      <Text style={{ color: "#ffffff", font: { size: 14, weight: "semibold" } }}>Phase 9</Text>
      <Progress value={42} maximum={100} />
      <List items={[{ id: "phase9", title: "Collection row", subtitle: "Native List" }]} />
      <YouTubePlayer videoId="M7lc1UVf-VE" controls />
      <Button label="Refresh" action={{ type: "invoke", name: "widget.refresh" }} />
    </Grid>
  </Box>
));
