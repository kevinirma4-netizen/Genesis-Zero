require('dotenv').config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const TOKEN = String(
  process.env.TOKEN ||
  process.env.DISCORD_TOKEN ||
  ''
)
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/^Bot\s+/i, '');

const CLIENT_ID = String(
  process.env.CLIENT_ID ||
  process.env.DISCORD_CLIENT_ID ||
  ''
)
  .trim()
  .replace(/^['"]|['"]$/g, '');

const GUILD_ID = String(
  process.env.GUILD_ID ||
  process.env.DISCORD_GUILD_ID ||
  ''
)
  .trim()
  .replace(/^['"]|['"]$/g, '');

if (!TOKEN) {
  throw new Error(
    'TOKEN missing.'
  );
}

if (!CLIENT_ID) {
  throw new Error(
    'CLIENT_ID missing.'
  );
}

if (!GUILD_ID) {
  throw new Error(
    'GUILD_ID missing.'
  );
}

const tryoutCommand =
  new SlashCommandBuilder()

    .setName(
      'tryout'
    )

    .setDescription(
      'Azure Of The Latch tryout tools'
    )

    .addSubcommand(
      s =>
        s
          .setName(
            'create'
          )
          .setDescription(
            'Create a tryout'
          )
    )

    .addSubcommand(
      s =>
        s
          .setName(
            'results'
          )
          .setDescription(
            'Create tryout results'
          )
    )

    .addSubcommand(
      s =>
        s

          .setName(
            'announce'
          )

          .setDescription(
            'Announce a tryout'
          )

          .addStringOption(
            o =>
              o

                .setName(
                  'unit'
                )

                .setDescription(
                  'Minutes or hours'
                )

                .setRequired(
                  true
                )

                .addChoices(

                  {
                    name:
                      'Minutes',

                    value:
                      'minutes'
                  },

                  {
                    name:
                      'Hours',

                    value:
                      'hours'
                  }
                )
          )

          .addIntegerOption(
            o =>
              o

                .setName(
                  'amount'
                )

                .setDescription(
                  'Duration'
                )

                .setRequired(
                  true
                )

                .setMinValue(
                  1
                )

                .setMaxValue(
                  240
                )
          )
    );

const scrimCommand =
  new SlashCommandBuilder()

    .setName(
      'scrim'
    )

    .setDescription(
      'Azure Of The Latch scrim tools'
    )

    .addSubcommand(
      s =>
        s

          .setName(
            'create'
          )

          .setDescription(
            'Create a scrim'
          )
    )

    .addSubcommand(
      s =>
        s

          .setName(
            'results'
          )

          .setDescription(
            'Create scrim results'
          )
    )

    .addSubcommand(
      s =>
        s

          .setName(
            'announce'
          )

          .setDescription(
            'Announce a scrim'
          )

          .addStringOption(
            o =>
              o

                .setName(
                  'type'
                )

                .setDescription(
                  'Friendly or ELO'
                )

                .setRequired(
                  true
                )

                .addChoices(

                  {
                    name:
                      'Friendly',

                    value:
                      'friendly'
                  },

                  {
                    name:
                      'ELO',

                    value:
                      'elo'
                  }
                )
          )

          .addStringOption(
            o =>
              o

                .setName(
                  'unit'
                )

                .setDescription(
                  'Minutes or hours'
                )

                .setRequired(
                  true
                )

                .addChoices(

                  {
                    name:
                      'Minutes',

                    value:
                      'minutes'
                  },

                  {
                    name:
                      'Hours',

                    value:
                      'hours'
                  }
                )
          )

          .addIntegerOption(
            o =>
              o

                .setName(
                  'amount'
                )

                .setDescription(
                  'Duration'
                )

                .setRequired(
                  true
                )

                .setMinValue(
                  1
                )

                .setMaxValue(
                  240
                )
          )
    );

const commands = [

  tryoutCommand.toJSON(),

  scrimCommand.toJSON()

];

(async () => {

  try {

    console.log(
      '⏳ Deploying commands...'
    );

    const rest =
      new REST({
        version:
          '10'
      })
        .setToken(
          TOKEN
        );

    await rest.put(

      Routes.applicationGuildCommands(
        CLIENT_ID,
        GUILD_ID
      ),

      {
        body:
          commands
      }
    );

    console.log(
      '✅ Commands deployed successfully.'
    );

    console.log(
      ''
    );

    console.log(
      '/tryout create'
    );

    console.log(
      '/tryout results'
    );

    console.log(
      '/tryout announce'
    );

    console.log(
      ''
    );

    console.log(
      '/scrim create'
    );

    console.log(
      '/scrim results'
    );

    console.log(
      '/scrim announce'
    );

  } catch (error) {

    console.error(
      '❌ Deploy failed:',
      error.message
    );

    process.exit(1);
  }

})();