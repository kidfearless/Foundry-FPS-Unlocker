Hooks.on("ready", OverrideValues);
Hooks.on("init", OverrideValues);


function OverrideValues()
{
	setTimeout(() => 
	{
		game.settings.register("core", "maxFPS", {
			name: "SETTINGS.MaxFPSN",
			hint: "SETTINGS.MaxFPSL",
			scope: "client",
			config: true,
			type: Number,
			range: { min: 10, max: 1000, step: 10 },
			default: 1000,
			onChange: () => 
			{
				canvas ? canvas.draw() : null;
			}
		});

		Canvas.prototype.draw = async function draw(scene)
		{
			scene = (scene === undefined ? game.scenes.viewed : scene) || null;
			const wasReady = this.ready;
			this.ready = false;

			// Tear down any existing scene
			if (wasReady) await this.tearDown();

			// Confirm there is an active scene
			this.scene = scene;
			this.id = scene?.id || null;
			if (this.scene === null)
			{
				console.log(`${vtt} | Skipping game canvas - no active scene.`);
				canvas.app.view.style.display = "none";
				ui.controls.render();
				return this;
			}
			else if (!(scene instanceof Scene))
			{
				throw new Error("You must provide a Scene entity to draw the VTT canvas.");
			}

			// Configure Scene to draw
			this.dimensions = this.constructor.getDimensions(scene.data);
			canvas.app.view.style.display = "block";
			document.documentElement.style.setProperty("--gridSize", this.dimensions.size + "px");

			// Configure rendering settings
			PIXI.settings.MIPMAP_TEXTURES = PIXI.MIPMAP_MODES[game.settings.get("core", "mipmap") ? "ON" : "OFF"];
			const maxFPS = game.settings.get("core", "maxFPS");
			this.app.ticker.maxFPS = maxFPS;

			// Call initialization hooks
			console.log(`${vtt} | Drawing game canvas for scene ${this.scene.name}`);
			Hooks.callAll('canvasInit', this);

			// Configure primary canvas stage
			this.stage.visible = false;
			this.stage.position.set(window.innerWidth / 2, window.innerHeight / 2);
			this.stage.hitArea = new PIXI.Rectangle(0, 0, this.dimensions.width, this.dimensions.height);
			this.stage.interactive = true;
			this.stage.sortableChildren = true;

			// Scene background color
			this.backgroundColor = scene.data.backgroundColor ? colorStringToHex(scene.data.backgroundColor) : 0x666666;
			this.app.renderer.backgroundColor = this.backgroundColor;

			// Load required textures
			await TextureLoader.loadSceneTextures(this.scene);

			// Draw layers
			for (let l of this.layers)
			{
				try
				{
					await l.draw();
				} catch (err)
				{
					// @ts-ignore
					ui.notifications.error(`Canvas drawing failed for the ${l.name}, see the console for more details.`);
					console.error(err);
				}
			}

			// Initialize starting conditions
			await this._initialize();

			// Add interactivity
			this._addListeners();

			// Mark the canvas as ready and call hooks
			this.stage.visible = this.ready = true;
			Hooks.call("canvasReady", this);
			this._reload = {};

			// Perform a final resize to ensure the rendered dimensions are correct
			this._onResize();
			return this;
		};
	}, 1000);
}

