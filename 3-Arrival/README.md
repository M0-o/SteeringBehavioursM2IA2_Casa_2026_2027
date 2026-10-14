# 3-Arrival — Snake Arrival

Snakes chase the mouse with the `arrive` behaviour. Food appears at random spots; when a head's magnet field touches a piece of food, the food is pulled into the head. Each piece eaten adds to the score and makes the snake longer.

## Entities (all extend `Vehicle`)

| File | Class | Behaviour |
| --- | --- | --- |
| `snake.js` | `Snake` | The snake **is** its head. Choosing the goal (`selectTarget`): mouse (`arrive`), wander (`wander`) or the nearest food (`seek`). Steering (`steer`): goal force + `stayInside` (built on `boundaries`) + head separation, added with weights and capped at `maxForce`. |
| `snakeSegment.js` | `SnakeSegment` | One body ring: `arrive(leader.pos, spacing)` on the ring in front. If it gets closer than `spacing`, its desired speed goes negative and it backs off. |
| `food.js` | `Food` | When no field touches it: `brake()` = `arrive(this.pos)`, so its desired velocity is zero. Inside a field: `seek` toward the head, and the pull gets stronger as it gets closer (magnet effect). |

Non-visual files: `game.js` (game controller, score, spawning, collisions), `snakeSettings.js` (slider limits, clamping, random settings), `controls.js` (DOM panel).

Every entity uses `applyForce` + `update` from `Vehicle`, and `vehicle.js` is unchanged.

## Settings (per snake)

Name, behaviour (follow mouse / wander / hunt food), pattern (solid / striped / gradient), two colours, head size, body thickness, length, max speed, acceleration (`maxForce`), braking radius (`rayonZoneDeFreinage`), magnet radius, magnet strength. Edits apply live to the selected snake. Click a head on the stage, or a row in the scoreboard, to select that snake.

World: number of food pieces, show magnet fields, debug (`d` key). `Space` pauses the game.

## Parameters that matter

- **Rings**: `maxSpeed = 2 × head maxSpeed` lets them catch up. `maxForce = 0.5 × maxSpeed` lets them brake inside their zone. Braking zone = `spacing + maxSpeed`: if it is narrower, the desired speed grows by more than 1 px/frame per pixel of gap, and the ring overshoots and oscillates.
- **Food**: spawns outside every magnet field, so a snake that stays still earns no free points.

## Run

Serve the folder with a static server (the font is loaded with `loadFont`), for example `python3 -m http.server`, then open `http://localhost:8000`.

## Tests

```bash
node --test tests/*.test.mjs
```

Nothing to install. The tests run the real classes in a `vm` context with a minimal `p5.Vector` adapter (`tests/helpers.mjs`) and a seeded random generator.
