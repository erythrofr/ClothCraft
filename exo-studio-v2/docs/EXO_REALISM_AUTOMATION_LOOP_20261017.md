# EXO Fabric, Stage, Pattern and MCP Milestone

The visible Stage gallery is curated to five rooms: MIKRISTIAN Cathedral House, R02 mountain runway, R03 mirror runway, S01 botanical studio, and S10 garden entrance. The original 20 Blender files remain safely preserved at docs/research/clo-connect-community/blender-scenes; fifteen passed a basic geometry export test and five remain unfinished. They are user-owned EXO interpretations, not the downloaded CLO CONNECT marketplace models. Simple physical materials and stage lighting still need measured photoreal improvement. See docs/stage-room-upgrade.md.

A live query of the Poly Haven CC0 model catalog returned 521 model assets but no verified fashion-specific buckle, zipper, snap or rivet models. Generic unrelated models were rejected. The 28 existing hardware thumbnails have been checked for valid source images, and ten weaker examples are hidden from the featured view. Future supplier-accurate replacements need actual geometry and provable redistribution licensing. The CC0 hardware search therefore did not add unverified files.

The fabric preview now shows a PBR-draped ball and matching color, normal and roughness maps. Its hanging geometry is influenced illustratively by estimated GSM and bend values. The ball is a material appearance viewer, NOT a physically validated simulator. The main Fabric inspector also has a Ball mode. The fabric catalog now leads with the 400-presets count, filter and fabrics; long explanations have been removed.

Only two genuine imported GLB hangers appear by default: a sculpted wood shoulder form and trouser clip rail. Hardware has 18 curated featured thumbnails; all 28 are available through the All designs option. Dimensions and manufacturer suitability still require physical verification.

The left Patterns category offers Import SVG / Illustrator Outlines. Closed SVG paths, polygons, rectangles, ellipses and circles become editable 2D pattern pieces with zero pre-created sewing. Embedded scripts, linked images and unsupported effects are refused, files are bounded to 3 MB, and the user can manually add or later automate sewing. CLO supports Adobe AI/PDF and industrial DXF pattern imports; those source formats differ from raw SVG.

The top EXO assistant uses deterministic intent routing for 13 verified actions including open library, change viewport, import SVG, load a pattern, apply known fabric, select stage/hanger, simulate/reset, save, undo/redo and export still. Unsupported requests receive honest errors; the assistant does not silently fabricate effects. Existing simple crop/width/seam-allowance commands still work.

The native-app MCP stdio implementation is at integrations/clothcraft/mcp-server.mjs. It forwards to the existing native agent API at http://127.0.0.1:5385/agent/v1 and never spawns another solver or external web service. Read-only operations: capabilities, status, project summary, actual 2D/3D line measurements. Write operations: pause, step, change drafting line target specification, requiring EXO_MCP_ALLOW_EDITS=1 AND exact expectedRevision. Any LLM can use this transport when configured in a compatible client, with the current tool schema; there is no promise of exhaustive EXO capability exposure.

Example external MCP client settings (substitute the actual local project path):

    {
      "mcpServers": {
        "exo-clothcraft-local": {
          "command": "node",
          "args": ["/path/to/exo-clothcraft-v2/integrations/clothcraft/mcp-server.mjs"],
          "env": {"EXO_MCP_BRIDGE_URL":"http://127.0.0.1:5385"}
        }
      }
    }

Checks:

    npm run build
    npm run qa:svg-fabric-ball
    npm run qa:assistant-actions
    node scripts/check-stage-scenes.mjs
    node scripts/check-hardware-quality.mjs
    node scripts/qa-hardware-curation.mjs

Next: expand every supported native command with schema validation, revision and undo semantics, scoped LLM permissions and isolated end-to-end tests; import truly material-matched 4K fabrics and measure physical specimen behavior under matched lighting.
