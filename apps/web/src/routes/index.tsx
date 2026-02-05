import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Spinner, Button, tokens } from "@fluentui/react-components";
import { ArrowClockwise24Regular, Games24Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/provider";
import { Desktop } from "@/components/desktop/Desktop";
import { settingsQueries } from "@/api/queries/settings";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// Wall boundaries
const WALL_THICKNESS = 20;
const CELL_SIZE = 18;
const BASE_SPEED = 120;
const MIN_SPEED = 50;

// Element IDs that can be eaten
const EATABLE_ELEMENTS = [
  "maint-image",
  "maint-title",
  "maint-message",
  "maint-apology",
  "maint-reload",
  "maint-game",
  "maint-score",
  "maint-highscore",
  "maint-instructions",
] as const;

type EatableElement = (typeof EATABLE_ELEMENTS)[number];

// Maintenance images available in /ma folder
const MAINTENANCE_IMAGES = [
  "/ma/1.jpeg",
  "/ma/2.jpeg",
  "/ma/3.jpeg",
  "/ma/4.jpeg",
  "/ma/5.jpg",
  "/ma/6.jpeg",
  "/ma/7.jpg",
  "/ma/8.jpg",
  "/ma/9.gif",
  "/ma/10.png",
  "/ma/11.gif",
  "/ma/12.gif",
  "/ma/13.gif",
  "/ma/14.gif",
  "/ma/15.gif",
  "/ma/16.gif",
  "/ma/17.gif",
  "/ma/18.gif",
];

// Track which elements have been eaten
interface EatenState {
  "maint-image": boolean;
  "maint-title": boolean;
  "maint-message": boolean;
  "maint-apology": boolean;
  "maint-reload": boolean;
  "maint-game": boolean;
  "maint-score": boolean;
  "maint-highscore": boolean;
  "maint-instructions": boolean;
}

function MaintenanceScreen({ message }: { message?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const displayMessage =
    message ||
    "The system is currently under maintenance. Please try again later.";

  // Pick a random image on mount
  const [randomImage] = useState(
    () =>
      MAINTENANCE_IMAGES[Math.floor(Math.random() * MAINTENANCE_IMAGES.length)],
  );

  // Game state
  const [gameActive, setGameActive] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Snake state
  const [snake, setSnake] = useState<{ x: number; y: number }[]>([]);
  const [direction, setDirection] = useState({ x: 1, y: 0 });
  const [nextDirection, setNextDirection] = useState({ x: 1, y: 0 });
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  // Track which elements have been eaten
  const [eaten, setEaten] = useState<EatenState>({
    "maint-image": false,
    "maint-title": false,
    "maint-message": false,
    "maint-apology": false,
    "maint-reload": false,
    "maint-game": false,
    "maint-score": false,
    "maint-highscore": false,
    "maint-instructions": false,
  });

  // Track elements currently being eaten (for animation)
  const [eating, setEating] = useState<Partial<EatenState>>({});

  // Get eating animation style for an element
  const getEatingStyle = (elementId: EatableElement): React.CSSProperties =>
    eating[elementId]
      ? {
          transform: "scale(0) rotate(180deg)",
          opacity: 0,
          transition: "transform 0.3s ease-in, opacity 0.3s ease-in",
        }
      : {};

  // Bonus food that spawns when game starts
  const [bonusFood, setBonusFood] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Spawn bonus food at random position
  const spawnBonusFood = useCallback(() => {
    if (!containerRef.current) return;
    const padding = WALL_THICKNESS + 30;
    const availableWidth = bounds.width - padding * 2;
    const availableHeight = bounds.height - padding * 2;
    setBonusFood({
      x: padding + Math.random() * availableWidth,
      y: padding + Math.random() * availableHeight,
    });
  }, [bounds]);

  // Spawn bonus food when game starts or when eaten
  useEffect(() => {
    if (gameActive && !bonusFood && !gameOver && bounds.width > 0) {
      spawnBonusFood();
    }
  }, [gameActive, bonusFood, gameOver, spawnBonusFood, bounds.width]);

  // Calculate speed based on snake length
  const getSpeed = useCallback(() => {
    const lengthBonus = Math.floor(snake.length / 3) * 5;
    return Math.max(MIN_SPEED, BASE_SPEED - lengthBonus);
  }, [snake.length]);

  // Initialize snake and bounds when game starts
  useEffect(() => {
    if (gameActive && containerRef.current && snake.length === 0) {
      const rect = containerRef.current.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });

      // Start snake in bottom-left safe area
      const startX = WALL_THICKNESS + CELL_SIZE * 5;
      const startY = rect.height - WALL_THICKNESS - CELL_SIZE * 5;
      setSnake([
        { x: startX, y: startY },
        { x: startX - CELL_SIZE, y: startY },
        { x: startX - CELL_SIZE * 2, y: startY },
      ]);
    }
  }, [gameActive, snake.length]);

  // Keyboard controls
  useEffect(() => {
    if (!gameActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;

      // Prevent scrolling
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
      ) {
        e.preventDefault();
      }

      // Start game on first key press
      const key = e.key;
      const isArrowKey = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(key);
      const isWASD = ["w", "a", "s", "d", "W", "A", "S", "D"].includes(key);

      if (!gameStarted && (isArrowKey || isWASD)) {
        setGameStarted(true);
      }

      // Handle direction changes
      if (key === "ArrowUp" || key === "w" || key === "W") {
        if (direction.y !== 1) setNextDirection({ x: 0, y: -1 });
      } else if (key === "ArrowDown" || key === "s" || key === "S") {
        if (direction.y !== -1) setNextDirection({ x: 0, y: 1 });
      } else if (key === "ArrowLeft" || key === "a" || key === "A") {
        if (direction.x !== 1) setNextDirection({ x: -1, y: 0 });
      } else if (key === "ArrowRight" || key === "d" || key === "D") {
        if (direction.x !== -1) setNextDirection({ x: 1, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameActive, direction, gameStarted, gameOver]);

  // Check collision with DOM elements
  const checkElementCollision = useCallback(
    (headX: number, headY: number): EatableElement | null => {
      const snakeCenterX = headX + CELL_SIZE / 2;
      const snakeCenterY = headY + CELL_SIZE / 2;

      for (const elementId of EATABLE_ELEMENTS) {
        if (eaten[elementId]) continue;

        const el = document.getElementById(elementId);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        // Check if snake head is inside or near the element
        if (
          snakeCenterX >= rect.left - CELL_SIZE / 2 &&
          snakeCenterX <= rect.right + CELL_SIZE / 2 &&
          snakeCenterY >= rect.top - CELL_SIZE / 2 &&
          snakeCenterY <= rect.bottom + CELL_SIZE / 2
        ) {
          return elementId;
        }
      }
      return null;
    },
    [eaten],
  );

  // Game loop
  useEffect(() => {
    if (!gameActive || !gameStarted || gameOver || !containerRef.current)
      return;

    const moveSnake = () => {
      setDirection(nextDirection);

      setSnake((prevSnake) => {
        if (prevSnake.length === 0) return prevSnake;

        const newHead = {
          x: prevSnake[0].x + nextDirection.x * CELL_SIZE,
          y: prevSnake[0].y + nextDirection.y * CELL_SIZE,
        };

        // Check wall collision
        if (
          newHead.x < WALL_THICKNESS ||
          newHead.x >= bounds.width - WALL_THICKNESS ||
          newHead.y < WALL_THICKNESS ||
          newHead.y >= bounds.height - WALL_THICKNESS
        ) {
          setGameOver(true);
          if (score > highScore) setHighScore(score);
          return prevSnake;
        }

        // Check self collision
        for (let i = 1; i < prevSnake.length; i++) {
          if (prevSnake[i].x === newHead.x && prevSnake[i].y === newHead.y) {
            setGameOver(true);
            if (score > highScore) setHighScore(score);
            return prevSnake;
          }
        }

        const newSnake = [newHead, ...prevSnake];

        // Check collision with page elements
        const hitElement = checkElementCollision(newHead.x, newHead.y);
        if (hitElement) {
          // Start eating animation
          setEating((prev) => ({ ...prev, [hitElement]: true }));
          setScore((s) => s + 10);
          // Remove element after animation
          setTimeout(() => {
            setEaten((prev) => ({ ...prev, [hitElement]: true }));
            setEating((prev) => ({ ...prev, [hitElement]: false }));
          }, 300);
        } else if (bonusFood) {
          // Check collision with bonus food
          const snakeCenterX = newHead.x + CELL_SIZE / 2;
          const snakeCenterY = newHead.y + CELL_SIZE / 2;
          const distance = Math.sqrt(
            Math.pow(bonusFood.x - snakeCenterX, 2) +
              Math.pow(bonusFood.y - snakeCenterY, 2),
          );
          if (distance < CELL_SIZE + 10) {
            setBonusFood(null); // Will trigger respawn via useEffect
            setScore((s) => s + 5);
          } else {
            newSnake.pop();
          }
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    };

    const interval = setInterval(moveSnake, getSpeed());
    return () => clearInterval(interval);
  }, [
    gameActive,
    gameStarted,
    gameOver,
    nextDirection,
    bounds,
    getSpeed,
    checkElementCollision,
    score,
    highScore,
    bonusFood,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background:
          "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        color: "white",
        padding: 40,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Walls - only shown when game is active */}
      {gameActive && (
        <>
          {/* Top wall */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: WALL_THICKNESS,
              background: "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.5)",
              zIndex: 60,
            }}
          />
          {/* Bottom wall */}
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              height: WALL_THICKNESS,
              background: "linear-gradient(0deg, #ef4444 0%, #991b1b 100%)",
              boxShadow: "0 -4px 12px rgba(239, 68, 68, 0.5)",
              zIndex: 60,
            }}
          />
          {/* Left wall */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: WALL_THICKNESS,
              background: "linear-gradient(90deg, #ef4444 0%, #991b1b 100%)",
              boxShadow: "4px 0 12px rgba(239, 68, 68, 0.5)",
              zIndex: 60,
            }}
          />
          {/* Right wall */}
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: WALL_THICKNESS,
              background: "linear-gradient(270deg, #ef4444 0%, #991b1b 100%)",
              boxShadow: "-4px 0 12px rgba(239, 68, 68, 0.5)",
              zIndex: 60,
            }}
          />
        </>
      )}

      {/* Score display */}
      {gameActive && !eaten["maint-score"] && (
        <div
          id="maint-score"
          style={{
            position: "fixed",
            top: WALL_THICKNESS + 10,
            right: WALL_THICKNESS + 10,
            background: "rgba(0, 0, 0, 0.8)",
            padding: "8px 16px",
            borderRadius: 8,
            color: "#22c55e",
            fontSize: 16,
            fontWeight: 600,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            ...getEatingStyle("maint-score"),
          }}
        >
          <span>Score: {score}</span>
          <span style={{ fontSize: 12, color: "#fbbf24" }}>
            Speed:{" "}
            {Math.round(
              (1 - (getSpeed() - MIN_SPEED) / (BASE_SPEED - MIN_SPEED)) * 100,
            )}
            %
          </span>
        </div>
      )}

      {/* High score display */}
      {gameActive && highScore > 0 && !eaten["maint-highscore"] && (
        <div
          id="maint-highscore"
          style={{
            position: "fixed",
            top: WALL_THICKNESS + 10,
            left: WALL_THICKNESS + 10,
            background: "rgba(0, 0, 0, 0.8)",
            padding: "8px 16px",
            borderRadius: 8,
            color: "#fbbf24",
            fontSize: 14,
            fontWeight: 600,
            zIndex: 100,
            ...getEatingStyle("maint-highscore"),
          }}
        >
          High Score: {highScore}
        </div>
      )}

      {/* Instructions */}
      {gameActive && !gameOver && !eaten["maint-instructions"] && (
        <div
          id="maint-instructions"
          style={{
            position: "fixed",
            bottom: WALL_THICKNESS + 10,
            left: "50%",
            transform: eating["maint-instructions"]
              ? "translateX(-50%) scale(0) rotate(180deg)"
              : "translateX(-50%)",
            background: "rgba(0, 0, 0, 0.8)",
            padding: "10px 20px",
            borderRadius: 8,
            color: "white",
            fontSize: 13,
            zIndex: 100,
            textAlign: "center",
            border: "1px solid rgba(34, 197, 94, 0.5)",
            opacity: eating["maint-instructions"] ? 0 : 1,
            transition: "transform 0.3s ease-in, opacity 0.3s ease-in",
          }}
        >
          {!gameStarted
            ? "Press Arrow Keys or WASD to start - Eat the elements!"
            : "Don't hit the walls or yourself!"}
        </div>
      )}

      {/* Game Over overlay */}
      {gameOver && (
        <div
          style={{
            position: "fixed",
            inset: WALL_THICKNESS,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 150,
          }}
        >
          <h2
            style={{
              fontSize: 48,
              color: "#ef4444",
              margin: 0,
              marginBottom: 16,
            }}
          >
            Game Over!
          </h2>
          <p
            style={{ fontSize: 24, color: "white", margin: 0, marginBottom: 8 }}
          >
            Score: {score}
          </p>
          <p
            style={{
              fontSize: 16,
              color: "#9ca3af",
              margin: 0,
              marginBottom: 24,
            }}
          >
            Snake length: {snake.length}
          </p>
          <Button
            appearance="primary"
            size="large"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Snake - rendered directly on the page */}
      {gameActive &&
        snake.map((segment, i) => (
          <div
            key={i}
            style={{
              position: "fixed",
              left: segment.x,
              top: segment.y,
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
              background:
                i === 0
                  ? "#22c55e"
                  : `hsl(142, 76%, ${Math.max(25, 43 - i * 2)}%)`,
              borderRadius: i === 0 ? 6 : 4,
              zIndex: 50,
              boxShadow:
                i === 0 ? "0 0 12px rgba(34, 197, 94, 0.8)" : undefined,
              border:
                i === 0
                  ? "2px solid #86efac"
                  : "1px solid rgba(255, 255, 255, 0.2)",
              pointerEvents: "none",
            }}
          />
        ))}

      {/* Bonus food - spawns after all elements eaten */}
      {bonusFood && (
        <div
          style={{
            position: "fixed",
            left: bonusFood.x - 10,
            top: bonusFood.y - 10,
            width: 20,
            height: 20,
            background: "radial-gradient(circle, #fbbf24 0%, #f59e0b 100%)",
            borderRadius: "50%",
            zIndex: 45,
            boxShadow: "0 0 16px rgba(251, 191, 36, 0.8)",
            animation: "pulse 1s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Page content - elements disappear when eaten */}
      {!eaten["maint-image"] && (
        <img
          id="maint-image"
          src={randomImage}
          alt="Maintenance"
          style={{
            maxWidth: 300,
            maxHeight: 200,
            objectFit: "contain",
            marginBottom: 24,
            borderRadius: 12,
            ...getEatingStyle("maint-image"),
          }}
        />
      )}

      {!eaten["maint-title"] && (
        <h1
          id="maint-title"
          style={{
            fontSize: 32,
            fontWeight: 600,
            marginBottom: 16,
            color: tokens.colorPaletteYellowForeground1,
            ...getEatingStyle("maint-title"),
          }}
        >
          IN MAINTENANCE
        </h1>
      )}

      {!eaten["maint-message"] && (
        <p
          id="maint-message"
          style={{
            fontSize: 18,
            maxWidth: 500,
            lineHeight: 1.6,
            color: "rgba(255, 255, 255, 0.8)",
            ...getEatingStyle("maint-message"),
          }}
        >
          {displayMessage}
        </p>
      )}

      {!eaten["maint-apology"] && (
        <p
          id="maint-apology"
          style={{
            marginTop: 32,
            fontSize: 14,
            color: "rgba(255, 255, 255, 0.5)",
            ...getEatingStyle("maint-apology"),
          }}
        >
          We apologize for any inconvenience.
        </p>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        {!eaten["maint-reload"] && (
          <div style={getEatingStyle("maint-reload")}>
            <Button
              id="maint-reload"
              appearance="primary"
              icon={<ArrowClockwise24Regular />}
              onClick={() => window.location.reload()}
              disabled={gameActive}
            >
              Reload
            </Button>
          </div>
        )}
        {!eaten["maint-game"] && (
          <div style={getEatingStyle("maint-game")}>
            <Button
              id="maint-game"
              appearance="secondary"
              icon={<Games24Regular />}
              onClick={() => setGameActive(true)}
              disabled={gameActive}
            >
              {gameActive ? ":)" : "i'm bored"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const userRole = (user as { role?: string } | undefined)?.role;
  const isDeveloper = userRole === "DEVELOPER";

  // Check maintenance status
  const { data: maintenance, isLoading: loadingMaintenance } = useQuery({
    ...settingsQueries.maintenance,
    // Don't refetch too frequently to avoid blocking issues
    staleTime: 10000,
  });

  if (isLoading || loadingMaintenance) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background:
            "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        }}
      >
        <Spinner size="huge" label="Loading..." style={{ color: "white" }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Show maintenance screen if maintenance mode is on and user is not a developer
  if (maintenance?.maintenanceMode && !isDeveloper) {
    return <MaintenanceScreen message={maintenance.maintenanceMessage} />;
  }

  return <Desktop />;
}
