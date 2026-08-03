import { Box, Button, Grid, Icon, Progress, Text, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "Phase 9 Interactive Fixture",
  "sdkVersion": "0.1.0",
  "size": { "width": 320, "height": 180 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": []
}, () => (
  <Box style={{ backgroundColor: "#111827", padding: 12, radius: 10 }}>
    <Grid columns={2} style={{ gap: 8 }}>
      <Icon name="bolt.fill" />
      <Text style={{ color: "#ffffff", font: { size: 14, weight: "semibold" } }}>Phase 9</Text>
      <Progress value={42} maximum={100} />
      <Button label="Refresh" action={{ type: "invoke", name: "widget.refresh" }} />
    </Grid>
  </Box>
));
