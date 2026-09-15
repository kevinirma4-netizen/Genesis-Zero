require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  Client,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags
} = require('discord.js');

/* =========================================
   CONFIG
========================================= */

const TOKEN =
  process.env.TOKEN ||
  process.env.DISCORD_TOKEN ||
  '';

const CLIENT_ID =
  process.env.CLIENT_ID ||
  '1547928788229423104';

const GUILD_ID =
  process.env.GUILD_ID ||
  '1540094724751233094';

const BANNER_URL =
  process.env.BANNER_URL ||
  'https://github.com/kevinirma4-netizen/azure-of-the-latch-banner/blob/main/image-1.png?raw=true';

const GOLD = 0xD9B45C;

/* =========================================
   ROLE CONFIG
========================================= */

const ROLES = {
  NEWBIE_HOSTER:
    process.env.NEWBIE_TRYOUT_HOSTER_ROLE_ID ||
    '1544063240512737461',

  HOSTER:
    process.env.TRYOUT_HOSTER_ROLE_ID ||
    '1540835937892958218',

  EXPERIENCED_HOSTER:
    process.env.EXPERIENCED_TRYOUT_HOSTER_ROLE_ID ||
    '1544063613038366772',

  HEAD_HOSTER:
    process.env.HEAD_TRYOUT_HOSTER_ROLE_ID ||
    '1544063863748694037',

  TRYOUT_PING:
    process.env.TRYOUT_PING_ROLE_ID ||
    '1540121303095443476',

  MAIN_TEAM:
    process.env.MAIN_TEAM_ROLE_ID ||
    '1543944947659448401',

  FRIENDLY_PING:
    process.env.FRIENDLY_SCRIM_PING_ROLE_ID ||
    '1540121250184036382',

  ELO_PING:
    process.env.ELO_SCRIM_PING_ROLE_ID ||
    '1543944947659448401'
};

/* =========================================
   OVR ROLES
========================================= */

const OVR_ROLES = {
  1: '1540112259647275048',
  2: '1540112290370818098',
  3: '1540112316924956924',
  4: '1540112341180358676',
  5: '1540112371400450139',
  6: '1540112404422201364',
  7: '1540112436697366608',
  8: '1540112461968048228',
  9: '1540112491936219186',
  10: '1540112516091482243'
};

/* =========================================
   CONSTANTS
========================================= */

const MAX_TRYOUT = 10;
const MAX_SCRIM_QUEUE = 30;
const RANDOM_PICK_MIN = 15;

const POSITIONS = [
  'CF',
  'CM',
  'GK',
  'RW',
  'LW'
];

const WARNING_MS = 120000;
const EXTENSION_MS = 120000;

/* =========================================
   DATA
========================================= */

const DATA_DIR =
  path.join(
    __dirname,
    'data'
  );

const PLAYER_FILE =
  path.join(
    DATA_DIR,
    'player-results.json'
  );

const SCRIM_FILE =
  path.join(
    DATA_DIR,
    'scrim-results.json'
  );

fs.mkdirSync(
  DATA_DIR,
  {
    recursive: true
  }
);

function loadJson(
  file,
  fallback
) {
  try {
    if (
      !fs.existsSync(
        file
      )
    ) {
      fs.writeFileSync(
        file,
        JSON.stringify(
          fallback,
          null,
          2
        )
      );

      return fallback;
    }

    const text =
      fs
        .readFileSync(
          file,
          'utf8'
        )
        .trim();

    return text
      ? JSON.parse(
          text
        )
      : fallback;
  } catch (
    error
  ) {
    console.error(
      'JSON load error:',
      error
    );

    return fallback;
  }
}

function saveJson(
  file,
  data
) {
  try {
    fs.writeFileSync(
      file,
      JSON.stringify(
        data,
        null,
        2
      )
    );
  } catch (
    error
  ) {
    console.error(
      'JSON save error:',
      error
    );
  }
}

let players =
  loadJson(
    PLAYER_FILE,
    {}
  );

let scrimResults =
  loadJson(
    SCRIM_FILE,
    []
  );

if (
  !players ||
  typeof players !==
    'object' ||
  Array.isArray(
    players
  )
) {
  players = {};
}

if (
  !Array.isArray(
    scrimResults
  )
) {
  scrimResults = [];
}

/* =========================================
   CLIENT / STATE
========================================= */

const client =
  new Client({
    intents: [
      GatewayIntentBits.Guilds
    ]
  });

const tryouts =
  new Map();

const scrims =
  new Map();

const announcements =
  new Map();

const resultSessions =
  new Map();

const pendingAnnouncements =
  new Map();

/* =========================================
   HELPERS
========================================= */

function mentionUser(
  id
) {
  return `<@${id}>`;
}

function mentionRole(
  id
) {
  return `<@&${id}>`;
}

function withBanner(
  embed
) {
  if (
    /^https?:\/\//i.test(
      BANNER_URL
    )
  ) {
    embed.setImage(
      BANNER_URL
    );
  }

  return embed;
}

function hasRole(
  member,
  roleId
) {
  return !!(
    member &&
    roleId &&
    member.roles &&
    member.roles.cache &&
    member.roles.cache.has(
      roleId
    )
  );
}

function isHoster(
  member
) {
  return [
    ROLES.NEWBIE_HOSTER,
    ROLES.HOSTER,
    ROLES.EXPERIENCED_HOSTER,
    ROLES.HEAD_HOSTER
  ].some(
    roleId =>
      hasRole(
        member,
        roleId
      )
  );
}

function isMainTeam(
  member
) {
  return hasRole(
    member,
    ROLES.MAIN_TEAM
  );
}

function validStat(
  value
) {
  const n =
    Number(
      String(
        value || ''
      ).trim()
    );

  return (
    Number.isInteger(
      n
    ) &&
    n >= 0 &&
    n <= 10
  )
    ? n
    : null;
}

function calculateOVR(
  stats
) {
  const values =
    Object.values(
      stats
    );

  if (
    !values.length
  ) {
    return 0;
  }

  return Math.round(
    values.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    ) /
      values.length
  );
}

function getPlayerData(
  userId
) {
  const raw =
    players[userId] &&
    typeof players[userId] ===
      'object'
      ? players[userId]
      : {};

  let currentScore =
    Number(
      raw.currentScore
    );

  let highestScore =
    Number(
      raw.highestScore
    );

  if (
    !Number.isInteger(
      currentScore
    ) ||
    currentScore < 0 ||
    currentScore > 10
  ) {
    currentScore = 0;
  }

  if (
    !Number.isInteger(
      highestScore
    ) ||
    highestScore < 0 ||
    highestScore > 10
  ) {
    highestScore = 0;
  }

  return {
    currentScore,

    highestScore:
      Math.max(
        currentScore,
        highestScore
      ),

    history:
      Array.isArray(
        raw.history
      )
        ? raw.history
        : []
  };
}

/* =========================================
   OVR ROLE ASSIGNMENT
========================================= */

async function setOVRRole(
  member,
  score
) {
  const targetId =
    OVR_ROLES[score];

  if (!targetId) {
    return false;
  }

  const target =
    member.guild.roles.cache.get(
      targetId
    );

  const bot =
    member.guild.members.me ||
    await member.guild.members
      .fetch(
        client.user.id
      )
      .catch(
        () => null
      );

  if (
    !target ||
    !bot
  ) {
    return false;
  }

  if (
    target.position >=
    bot.roles.highest.position
  ) {
    console.error(
      `❌ Bot role must be above the ${score}/10 role.`
    );

    return false;
  }

  for (
    let n = 1;
    n <= 10;
    n++
  ) {
    const oldRole =
      member.guild.roles.cache.get(
        OVR_ROLES[n]
      );

    if (
      oldRole &&
      oldRole.id !==
        target.id &&
      member.roles.cache.has(
        oldRole.id
      ) &&
      oldRole.position <
        bot.roles.highest.position
    ) {
      await member.roles
        .remove(
          oldRole
        )
        .catch(
          () => {}
        );
    }
  }

  if (
    !member.roles.cache.has(
      target.id
    )
  ) {
    await member.roles
      .add(
        target
      )
      .catch(
        error => {
          console.error(
            'OVR role error:',
            error.message
          );
        }
      );
  }

  return member.roles.cache.has(
    target.id
  );
}

/* =========================================
   TRYOUT EMBED
========================================= */

function tryoutEmbed(
  lobby
) {
  const list =
    lobby.players.length
      ? lobby.players
          .map(
            (
              id,
              index
            ) =>
              `**${index + 1}.** ${mentionUser(id)}`
          )
          .join('\n')
      : '`Waiting for players...`';

  const filled =
    Math.round(
      (
        lobby.players.length /
        MAX_TRYOUT
      ) *
        10
    );

  const bar =
    '▰'.repeat(
      filled
    ) +
    '▱'.repeat(
      10 - filled
    );

  let serverText =
    '`Hidden until 10/10.`';

  if (
    lobby.players.length ===
    MAX_TRYOUT
  ) {
    serverText =
      lobby.serverLink
        ? `[JOIN PRIVATE SERVER](${lobby.serverLink})`
        : '`Server link not added.`';
  }

  return withBanner(
    new EmbedBuilder()
      .setColor(
        GOLD
      )
      .setAuthor({
        name:
          'Azure Of The Latch x S E N B O N'
      })
      .setTitle(
        'TRYOUT HUB'
      )
      .setDescription(
        `**HOST**\n${mentionUser(lobby.hostId)}\n\n` +
        `**PLAYERS — ${lobby.players.length}/${MAX_TRYOUT}**\n` +
        `${bar}\n\n` +
        `**PLAYER LIST**\n${list}`
      )
      .addFields({
        name:
          'SERVER',
        value:
          serverText
      })
      .setFooter({
        text:
          'Azure Of The Latch • Tryout Hub'
      })
  );
}

function tryoutButtons(
  lobby
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tryout_join:${lobby.messageId}`
          )
          .setLabel(
            'JOIN'
          )
          .setStyle(
            ButtonStyle.Success
          )
          .setDisabled(
            lobby.players.length >=
              MAX_TRYOUT
          ),

        new ButtonBuilder()
          .setCustomId(
            `tryout_leave:${lobby.messageId}`
          )
          .setLabel(
            'LEAVE'
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            `tryout_link:${lobby.messageId}`
          )
          .setLabel(
            'SERVER LINK'
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            `tryout_close:${lobby.messageId}`
          )
          .setLabel(
            'CLOSE'
          )
          .setStyle(
            ButtonStyle.Danger
          )
      )
  ];
}

async function refreshTryout(
  lobby
) {
  try {
    const channel =
      await client.channels.fetch(
        lobby.channelId
      );

    const message =
      await channel.messages.fetch(
        lobby.messageId
      );

    await message.edit({
      embeds: [
        tryoutEmbed(
          lobby
        )
      ],

      components:
        tryoutButtons(
          lobby
        )
    });
  } catch (
    error
  ) {
    console.error(
      'Tryout refresh error:',
      error.message
    );
  }
}

/* =========================================
   TRYOUT RESULT
========================================= */

function resultTypeEmbed(
  userId
) {
  return withBanner(
    new EmbedBuilder()
      .setColor(
        GOLD
      )
      .setAuthor({
        name:
          'Azure Of The Latch'
      })
      .setTitle(
        'PLAYER TYPE'
      )
      .setDescription(
        `${mentionUser(userId)}\n\nChoose the result type.`
      )
  );
}

function resultModal(
  type,
  userId
) {
  const labels =
    type === 'gk'
      ? [
          'Goalkeeping',
          'Reaction Time',
          'Passing',
          'Defending'
        ]
      : [
          'Shooting',
          'Passing',
          'Teamwork',
          'Defending'
        ];

  const modal =
    new ModalBuilder()
      .setCustomId(
        `result_stats:${type}:${userId}`
      )
      .setTitle(
        type === 'gk'
          ? 'Goalkeeper Result'
          : 'Striker Result'
      );

  labels.forEach(
    (
      label,
      index
    ) => {
      modal.addComponents(
        new ActionRowBuilder()
          .addComponents(
            new TextInputBuilder()
              .setCustomId(
                `stat_${index + 1}`
              )
              .setLabel(
                label
              )
              .setPlaceholder(
                '0-10'
              )
              .setStyle(
                TextInputStyle.Short
              )
              .setRequired(
                true
              )
              .setMinLength(
                1
              )
              .setMaxLength(
                2
              )
          )
      );
    }
  );

  modal.addComponents(
    new ActionRowBuilder()
      .addComponents(
        new TextInputBuilder()
          .setCustomId(
            'fixes'
          )
          .setLabel(
            'Things to fix'
          )
          .setStyle(
            TextInputStyle.Paragraph
          )
          .setRequired(
            false
          )
          .setMaxLength(
            500
          )
      )
  );

  return modal;
}

function finalTryoutEmbed(
  userId,
  current,
  best,
  stats,
  fixes
) {
  const roleId =
    OVR_ROLES[current];

  const roleText =
    roleId
      ? mentionRole(
          roleId
        )
      : 'No OVR role';

  const statsText =
    Object.entries(
      stats
    )
      .map(
        (
          [
            name,
            value
          ]
        ) =>
          `**${name}:** ${value}/10`
      )
      .join(
        '  '
      );

  return withBanner(
    new EmbedBuilder()
      .setColor(
        GOLD
      )
      .setAuthor({
        name:
          'Azure Of The Latch'
      })
      .setTitle(
        '✦ TRYOUT RESULT ✦'
      )
      .setDescription(
        '╭────────────────────╮\n' +
        `│ **PLAYER**\n│ ${mentionUser(userId)}\n` +
        '╰────────────────────╯'
      )
      .addFields(
        {
          name:
            '◈ OVR',

          value:
            `**${current}/10**\n${roleText}`,

          inline:
            true
        },

        {
          name:
            '◆ BEST RESULT',

          value:
            `**${best}**`,

          inline:
            true
        },

        {
          name:
            '✦ STATS',

          value:
            statsText,

          inline:
            false
        },

        {
          name:
            '📝 THINGS TO FIX',

          value:
            fixes && fixes.trim()
              ? fixes
                  .trim()
                  .split('\n')
                  .map(
                    line =>
                      `> ${line.trim()}`
                  )
                  .join('\n')
              : '> Nothing specific noted.',

          inline:
            false
        }
      )
      .setFooter({
        text:
          'Azure Of The Latch • Tryout Results'
      })
      .setTimestamp()
  );
}

/* =========================================
   ANNOUNCEMENTS
========================================= */

function announcementEmbed(
  announcement
) {
  const end =
    announcement.phase ===
    'extension'
      ? announcement.extensionEnd
      : announcement.end;

  const seconds =
    Math.max(
      0,
      Math.ceil(
        (
          end -
          Date.now()
        ) /
          1000
      )
    );

  const left =
    `${Math.floor(
      seconds / 60
    )}m ${seconds % 60}s`;

  let title =
    announcement.type ===
    'tryout'
      ? 'TRYOUT ANNOUNCEMENT'
      : announcement.type ===
        'elo'
        ? 'ELO SCRIM ANNOUNCEMENT'
        : 'FRIENDLY SCRIM ANNOUNCEMENT';

  if (
    announcement.warning &&
    announcement.phase ===
      'active'
  ) {
    title =
      'CLOSING SOON';
  }

  if (
    announcement.phase ===
    'extension'
  ) {
    title =
      'EXTENSION ACTIVE';
  }

  const ready =
    announcement.ready.length
      ? announcement.ready
          .map(
            (
              id,
              index
            ) =>
              `**${index + 1}.** ${mentionUser(id)}`
          )
          .join('\n')
      : '`No READY players.`';

  return withBanner(
    new EmbedBuilder()
      .setColor(
        announcement.phase ===
          'extension'
          ? 0xB84949
          : GOLD
      )
      .setAuthor({
        name:
          'Azure Of The Latch'
      })
      .setTitle(
        title
      )
      .setDescription(
        `> **${left}** remaining\n\n` +
        `**HOST**\n${mentionUser(announcement.hostId)}\n\n` +
        `**READY — ${announcement.ready.length}/${MAX_TRYOUT}**\n${ready}` +
        (
          announcement.message
            ? `\n\n**MESSAGE**\n${announcement.message}`
            : ''
        )
      )
      .setFooter({
        text:
          'READY • NOT READY • RE-PING'
      })
  );
}

function announcementButtons(
  announcement
) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId(
        `announce_ready:${announcement.messageId}`
      )
      .setLabel(
        `READY ${announcement.ready.length}/${MAX_TRYOUT}`
      )
      .setStyle(
        ButtonStyle.Success
      ),

    new ButtonBuilder()
      .setCustomId(
        `announce_notready:${announcement.messageId}`
      )
      .setLabel(
        'NOT READY'
      )
      .setStyle(
        ButtonStyle.Secondary
      )
  ];

  if (
    announcement.warning ||
    announcement.phase ===
      'extension'
  ) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(
          `announce_reping:${announcement.messageId}`
        )
        .setLabel(
          'RE-PING'
        )
        .setStyle(
          ButtonStyle.Primary
        )
        .setDisabled(
          announcement.reping
        )
    );
  }

  return [
    new ActionRowBuilder()
      .addComponents(
        buttons
      )
  ];
}

async function refreshAnnouncement(
  announcement
) {
  try {
    const channel =
      await client.channels.fetch(
        announcement.channelId
      );

    const message =
      await channel.messages.fetch(
        announcement.messageId
      );

    await message.edit({
      embeds: [
        announcementEmbed(
          announcement
        )
      ],

      components:
        announcementButtons(
          announcement
        )
    });
  } catch (
    error
  ) {
    console.error(
      'Announcement refresh error:',
      error.message
    );
  }
}

async function pingAnnouncement(
  announcement
) {
  let roleId =
    null;

  if (
    announcement.type ===
    'tryout'
  ) {
    roleId =
      ROLES.TRYOUT_PING;
  } else if (
    announcement.type ===
    'elo'
  ) {
    roleId =
      ROLES.ELO_PING;
  } else {
    roleId =
      ROLES.FRIENDLY_PING;
  }

  if (!roleId) {
    return;
  }

  try {
    const channel =
      await client.channels.fetch(
        announcement.channelId
      );

    await channel.send({
      content:
        mentionRole(
          roleId
        ),

      allowedMentions: {
        roles: [
          roleId
        ]
      }
    });
  } catch (
    error
  ) {
    console.error(
      'Announcement ping error:',
      error.message
    );
  }
}

/* =========================================
   SCRIM CREATE
========================================= */

function scrimTypeEmbed() {
  return withBanner(
    new EmbedBuilder()
      .setColor(
        0x4B9BE8
      )
      .setAuthor({
        name:
          'Azure Of The Latch'
      })
      .setTitle(
        'SELECT SCRIM TYPE'
      )
      .setDescription(
        '**ELO**\n' +
        'Main Team required.\n\n' +
        '**FRIENDLY**\n' +
        'No Main Team requirement.'
      )
      .setFooter({
        text:
          '5 players • CF / CM / GK / RW / LW'
      })
  );
}

function scrimTypeButtons() {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'scrim_type:elo'
          )
          .setLabel(
            'ELO'
          )
          .setStyle(
            ButtonStyle.Danger
          ),

        new ButtonBuilder()
          .setCustomId(
            'scrim_type:friendly'
          )
          .setLabel(
            'FRIENDLY'
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            'scrim_type:close'
          )
          .setLabel(
            'CLOSE'
          )
          .setStyle(
            ButtonStyle.Secondary
          )
      )
  ];
}

function scrimQueueEmbed(
  scrim
) {
  const queue =
    scrim.players.length
      ? scrim.players
          .map(
            (
              player,
              index
            ) =>
              `**${index + 1}.** ${mentionUser(player.id)}${
                player.position
                  ? ` — ${player.position}`
                  : ''
              }`
          )
          .join('\n')
      : '`No players yet.`';

  const lineup =
    scrim.selected.length
      ? scrim.selected
          .map(
            player =>
              `**${player.position}** — ${mentionUser(player.id)}`
          )
          .join('\n')
      : '`Waiting for Random Pick...`';

  return withBanner(
    new EmbedBuilder()
      .setColor(
        scrim.type ===
          'elo'
          ? 0xB84949
          : 0x4B9BE8
      )
      .setAuthor({
        name:
          'Azure Of The Latch'
      })
      .setTitle(
        scrim.type ===
          'elo'
          ? 'ELO SCRIM'
          : 'FRIENDLY SCRIM'
      )
      .setDescription(
        `**QUEUE — ${scrim.players.length}/${MAX_SCRIM_QUEUE}**\n\n` +
        `${queue}\n\n` +
        '━━━━━━━━━━━━━━━━\n\n' +
        `**LINEUP**\n${lineup}` +
        (
          scrim.serverLink
            ? `\n\n[JOIN SCRIM SERVER](${scrim.serverLink})`
            : ''
        )
      )
      .setFooter({
        text:
          scrim.players.length >=
          RANDOM_PICK_MIN
            ? 'RANDOM PICK AVAILABLE'
            : 'Join • choose a position'
      })
  );
}

function scrimQueueButtons(
  scrim
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `scrim_join:${scrim.messageId}`
          )
          .setLabel(
            'JOIN'
          )
          .setStyle(
            ButtonStyle.Success
          )
          .setDisabled(
            scrim.players.length >=
              MAX_SCRIM_QUEUE
          ),

        new ButtonBuilder()
          .setCustomId(
            `scrim_leave:${scrim.messageId}`
          )
          .setLabel(
            'LEAVE'
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            `scrim_link:${scrim.messageId}`
          )
          .setLabel(
            'SERVER LINK'
          )
          .setStyle(
            ButtonStyle.Primary
          )
      ),

    new ActionRowBuilder()
      .addComponents(
        POSITIONS.map(
          position =>
            new ButtonBuilder()
              .setCustomId(
                `scrim_position:${position}:${scrim.messageId}`
              )
              .setLabel(
                position
              )
              .setStyle(
                ButtonStyle.Secondary
              )
        )
      ),

    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `scrim_random:${scrim.messageId}`
          )
          .setLabel(
            'RANDOM PICK'
          )
          .setStyle(
            ButtonStyle.Danger
          )
          .setDisabled(
            scrim.players.length <
              RANDOM_PICK_MIN
          ),

        new ButtonBuilder()
          .setCustomId(
            `scrim_close:${scrim.messageId}`
          )
          .setLabel(
            'CLOSE'
          )
          .setStyle(
            ButtonStyle.Secondary
          )
      )
  ];
}

function selectedScrimEmbed(
  scrim
) {
  const lineup =
    scrim.selected
      .map(
        player =>
          `**${player.position}** — ${mentionUser(player.id)}${
            player.ready
              ? ' • READY'
              : ''
          }`
      )
      .join('\n');

  return withBanner(
    new EmbedBuilder()
      .setColor(
        0x5BC47B
      )
      .setAuthor({
        name:
          'Azure Of The Latch'
      })
      .setTitle(
        '✦ SCRIM READY ✦'
      )
      .setDescription(
        `**${
          scrim.type ===
          'elo'
            ? 'ELO'
            : 'FRIENDLY'
        }**\n\n` +
        '╭────────────────────╮\n' +
        `${lineup}\n` +
        '╰────────────────────╯' +
        (
          scrim.serverLink
            ? `\n\n[◈ JOIN SCRIM SERVER](${scrim.serverLink})`
            : ''
        )
      )
  );
}

function selectedScrimButtons(
  scrim
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        scrim.selected.map(
          player =>
            new ButtonBuilder()
              .setCustomId(
                `scrim_ready:${scrim.messageId}:${player.id}`
              )
              .setLabel(
                `${player.position} • ${
                  player.ready
                    ? 'READY'
                    : 'READY?'
                }`
              )
              .setStyle(
                player.ready
                  ? ButtonStyle.Success
                  : ButtonStyle.Secondary
              )
        )
      )
  ];
}

async function refreshScrim(
  scrim
) {
  try {
    const channel =
      await client.channels.fetch(
        scrim.channelId
      );

    const message =
      await channel.messages.fetch(
        scrim.messageId
      );

    await message.edit({
      embeds: [
        scrim.phase ===
        'selected'
          ? selectedScrimEmbed(
              scrim
            )
          : scrimQueueEmbed(
              scrim
            )
      ],

      components:
        scrim.phase ===
        'selected'
          ? selectedScrimButtons(
              scrim
            )
          : scrimQueueButtons(
              scrim
            )
    });
  } catch (
    error
  ) {
    console.error(
      'Scrim refresh error:',
      error.message
    );
  }
}

function shuffle(
  list
) {
  const copy =
    [
      ...list
    ];

  for (
    let i =
      copy.length -
      1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );

    [
      copy[i],
      copy[j]
    ] = [
      copy[j],
      copy[i]
    ];
  }

  return copy;
}

function randomPick(
  scrim
) {
  if (
    scrim.players.length <
    5
  ) {
    return false;
  }

  const selected =
    shuffle(
      scrim.players
    ).slice(
      0,
      5
    );

  const positions =
    shuffle(
      POSITIONS
    );

  scrim.selected =
    selected.map(
      (
        player,
        index
      ) => ({
        id:
          player.id,

        position:
          positions[index],

        ready:
          false
      })
    );

  scrim.phase =
    'selected';

  return true;
}

/* =========================================
   SCRIM RESULTS
========================================= */

function scrimResultEmbed(
  result
) {
  const score1 =
    result.rounds.filter(
      round =>
        round.winner ===
        1
    ).length;

  const score2 =
    result.rounds.filter(
      round =>
        round.winner ===
        2
    ).length;

  const roundsText =
    result.rounds.length
      ? result.rounds
          .map(
            round =>
              `**R${round.round}**  •  ${round.s1} — ${round.s2}`
          )
          .join('\n')
      : '`No rounds yet.`';

  const mvpText =
    result.mvp
      ? `${mentionUser(result.mvp.userId)}  •  ${result.mvp.goals} goals  •  ${result.mvp.roundsPlayed} rounds`
      : '`Not set yet.`';

  return withBanner(
    new EmbedBuilder()
      .setColor(
        0x4B9BE8
      )
      .setAuthor({
        name:
          'Azure Of The Latch'
      })
      .setTitle(
        '✦ SCRIM RESULT ✦'
      )
      .setDescription(
        '╭────────────────────────────╮\n' +
        `│ **${result.club1}**  ${score1}  —  ${score2}  **${result.club2}**\n` +
        '╰────────────────────────────╯'
      )
      .addFields(
        {
          name:
            '◈ ROUNDS',

          value:
            roundsText,

          inline:
            true
        },

        {
          name:
            '◆ MVP',

          value:
            mvpText,

          inline:
            true
        },

        {
          name:
            '✦ PARTICIPANTS',

          value:
            result.participants.length
              ? result.participants
                  .map(
                    mentionUser
                  )
                  .join('\n')
              : '`None`'
        }
      )
      .setFooter({
        text:
          'Azure Of The Latch • Scrim Results'
      })
  );
}

function scrimResultButtons(
  result
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `result_add_round:${result.id}`
          )
          .setLabel(
            'ADD ROUND'
          )
          .setStyle(
            ButtonStyle.Primary
          )
          .setDisabled(
            result.rounds.length >=
              6
          ),

        new ButtonBuilder()
          .setCustomId(
            `result_mvp:${result.id}`
          )
          .setLabel(
            'MVP'
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            `result_finish:${result.id}`
          )
          .setLabel(
            'FINISH'
          )
          .setStyle(
            ButtonStyle.Success
          )
      )
  ];
}

/* =========================================
   MVP SELECT
========================================= */

function mvpPlayerSelect(
  sessionId
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(
            `result_mvp_player:${sessionId}`
          )
          .setPlaceholder(
            'Select MVP player'
          )
          .setMinValues(
            1
          )
          .setMaxValues(
            1
          )
      )
  ];
}

function mvpStatsModal(
  sessionId,
  userId
) {
  const modal =
    new ModalBuilder()
      .setCustomId(
        `result_mvp_stats:${sessionId}:${userId}`
      )
      .setTitle(
        'MVP Details'
      );

  modal.addComponents(
    new ActionRowBuilder()
      .addComponents(
        new TextInputBuilder()
          .setCustomId(
            'goals'
          )
          .setLabel(
            'Goals'
          )
          .setStyle(
            TextInputStyle.Short
          )
          .setRequired(
            true
          )
          .setPlaceholder(
            '0'
          )
      ),

    new ActionRowBuilder()
      .addComponents(
        new TextInputBuilder()
          .setCustomId(
            'rounds'
          )
          .setLabel(
            'Rounds played'
          )
          .setStyle(
            TextInputStyle.Short
          )
          .setRequired(
            true
          )
          .setPlaceholder(
            '1-6'
          )
      )
  );

  return modal;
}

function publicFinalScrimEmbed(
  result
) {
  const score1 =
    result.rounds.filter(
      round =>
        round.winner ===
        1
    ).length;

  const score2 =
    result.rounds.filter(
      round =>
        round.winner ===
        2
    ).length;

  const winner =
    score1 > score2
      ? result.club1
      : result.club2;

  const roundsText =
    result.rounds.length
      ? result.rounds
          .map(
            round =>
              `**R${round.round}**  •  ${round.s1} — ${round.s2}`
          )
          .join('\n')
      : '`No rounds recorded.`';

  const participants =
    result.participants.length
      ? result.participants
          .map(
            mentionUser
          )
          .join(' • ')
      : '`None`';

  const mvp =
    result.mvp
      ? `${mentionUser(result.mvp.userId)}\n**${result.mvp.goals} goals** • ${result.mvp.roundsPlayed} rounds`
      : '`Not recorded`';

  return withBanner(
    new EmbedBuilder()
      .setColor(
        GOLD
      )
      .setAuthor({
        name:
          'AZURE OF THE LATCH • OFFICIAL'
      })
      .setTitle(
        '🏆  O F F I C I A L  S C R I M  R E S U L T'
      )
      .setDescription(
        '╔══════════════════════════════════╗\n' +
        `        **${result.club1}**\n` +
        `             **${score1}  —  ${score2}**\n` +
        `        **${result.club2}**\n` +
        '╚══════════════════════════════════╝\n\n' +
        `✦ **WINNER**  ›  **${winner}**`
      )
      .addFields(
        {
          name:
            '◈ ROUND BREAKDOWN',

          value:
            roundsText,

          inline:
            true
        },

        {
          name:
            '◆ MVP',

          value:
            mvp,

          inline:
            true
        },

        {
          name:
            '✦ LINEUP',

          value:
            participants
        }
      )
      .setFooter({
        text:
          'Azure Of The Latch • Official Scrim Result'
      })
      .setTimestamp()
  );
}

/* =========================================
   SLASH COMMANDS
========================================= */

function buildCommands() {
  const tryout =
    new SlashCommandBuilder()
      .setName(
        'tryout'
      )
      .setDescription(
        'Azure Of The Latch tryout tools'
      )

      .addSubcommand(
        sub =>
          sub
            .setName(
              'create'
            )
            .setDescription(
              'Create a tryout lobby'
            )
      )

      .addSubcommand(
        sub =>
          sub
            .setName(
              'results'
            )
            .setDescription(
              'Create a tryout result'
            )
      )

      .addSubcommand(
        sub =>
          sub
            .setName(
              'announce'
            )
            .setDescription(
              'Create a tryout announcement'
            )

            .addStringOption(
              option =>
                option
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
              option =>
                option
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

  const scrim =
    new SlashCommandBuilder()
      .setName(
        'scrim'
      )
      .setDescription(
        'Azure Of The Latch scrim tools'
      )

      .addSubcommand(
        sub =>
          sub
            .setName(
              'create'
            )
            .setDescription(
              'Create a scrim'
            )
      )

      .addSubcommand(
        sub =>
          sub
            .setName(
              'results'
            )
            .setDescription(
              'Create a scrim result'
            )
      )

      .addSubcommand(
        sub =>
          sub
            .setName(
              'announce'
            )
            .setDescription(
              'Create a scrim announcement'
            )

            .addStringOption(
              option =>
                option
                  .setName(
                    'type'
                  )
                  .setDescription(
                    'Scrim type'
                  )
                  .setRequired(
                    true
                  )
                  .addChoices(
                    {
                      name:
                        'ELO',
                      value:
                        'elo'
                    },
                    {
                      name:
                        'Friendly',
                      value:
                        'friendly'
                    }
                  )
            )

            .addStringOption(
              option =>
                option
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
              option =>
                option
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

  return [
    tryout.toJSON(),
    scrim.toJSON()
  ];
}

async function registerCommands() {
  const rest =
    new REST({
      version:
        '10'
    }).setToken(
      TOKEN
    );

  await rest.put(
    Routes.applicationGuildCommands(
      CLIENT_ID,
      GUILD_ID
    ),
    {
      body:
        buildCommands()
    }
  );

  console.log(
    '✅ Slash commands registered.'
  );
}

/* =========================================
   PRESENCE
========================================= */

function updatePresence() {
  if (
    !client.user
  ) {
    return;
  }

  client.user.setPresence({
    status:
      'online',

    activities: [
      {
        name:
          `Azure Of The Latch • ${tryouts.size}T / ${scrims.size}S`,

        type:
          ActivityType.Watching
      }
    ]
  });
}

/* =========================================
   INTERACTIONS
========================================= */

client.on(
  'interactionCreate',
  async interaction => {
    try {

      /* =====================================
         CHAT INPUT
      ===================================== */

      if (
        interaction.isChatInputCommand()
      ) {
        if (
          !isHoster(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              '❌ You need a Tryout Hoster role.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        const sub =
          interaction.options.getSubcommand();

        /* ===================================
           TRYOUT
        =================================== */

        if (
          interaction.commandName ===
          'tryout'
        ) {

          if (
            sub ===
            'create'
          ) {
            if (
              [
                ...tryouts.values()
              ].some(
                lobby =>
                  lobby.hostId ===
                  interaction.user.id
              )
            ) {
              return interaction.reply({
                content:
                  '❌ You already have an active tryout.',

                flags:
                  MessageFlags.Ephemeral
              });
            }

            const lobby = {
              hostId:
                interaction.user.id,

              guildId:
                interaction.guildId,

              channelId:
                interaction.channelId,

              messageId:
                'pending',

              players:
                [],

              serverLink:
                null
            };

            const message =
              await interaction.channel.send({
                content:
                  mentionRole(
                    ROLES.TRYOUT_PING
                  ),

                embeds: [
                  tryoutEmbed(
                    lobby
                  )
                ],

                components: [
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId(
                          'temporary'
                        )
                        .setLabel(
                          'JOIN'
                        )
                        .setStyle(
                          ButtonStyle.Success
                        )
                        .setDisabled(
                          true
                        )
                    )
                ],

                allowedMentions: {
                  roles: [
                    ROLES.TRYOUT_PING
                  ]
                }
              });

            lobby.messageId =
              message.id;

            tryouts.set(
              message.id,
              lobby
            );

            await refreshTryout(
              lobby
            );

            updatePresence();

            return interaction.reply({
              content:
                '✅ Tryout created.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            sub ===
            'results'
          ) {
            return interaction.reply({
              embeds: [
                withBanner(
                  new EmbedBuilder()
                    .setColor(
                      GOLD
                    )
                    .setAuthor({
                      name:
                        'Azure Of The Latch'
                    })
                    .setTitle(
                      'SELECT PLAYER'
                    )
                    .setDescription(
                      'Choose the player you want to evaluate.'
                    )
                )
              ],

              components: [
                new ActionRowBuilder()
                  .addComponents(
                    new UserSelectMenuBuilder()
                      .setCustomId(
                        'result_player'
                      )
                      .setPlaceholder(
                        'Select player'
                      )
                      .setMinValues(
                        1
                      )
                      .setMaxValues(
                        1
                      )
                  )
              ],

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            sub ===
            'announce'
          ) {
            const unit =
              interaction.options.getString(
                'unit'
              );

            const amount =
              interaction.options.getInteger(
                'amount'
              );

            const key =
              Date.now().toString() +
              Math.random()
                .toString(
                  36
                )
                .slice(
                  2,
                  8
                );

            pendingAnnouncements.set(
              key,
              {
                hostId:
                  interaction.user.id,

                guildId:
                  interaction.guildId,

                channelId:
                  interaction.channelId,

                type:
                  'tryout',

                duration:
                  amount *
                  (
                    unit ===
                    'hours'
                      ? 3600000
                      : 60000
                  )
              }
            );

            const modal =
              new ModalBuilder()
                .setCustomId(
                  `announce_modal:${key}`
                )
                .setTitle(
                  'Tryout Announcement'
                )
                .addComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new TextInputBuilder()
                        .setCustomId(
                          'message'
                        )
                        .setLabel(
                          'Announcement text'
                        )
                        .setStyle(
                          TextInputStyle.Paragraph
                        )
                        .setRequired(
                          false
                        )
                        .setMaxLength(
                          1000
                        )
                    )
                );

            return interaction.showModal(
              modal
            );
          }
        }

        /* ===================================
           SCRIM
        =================================== */

        if (
          interaction.commandName ===
          'scrim'
        ) {

          if (
            sub ===
            'create'
          ) {
            if (
              [
                ...scrims.values()
              ].some(
                scrim =>
                  scrim.hostId ===
                  interaction.user.id
              )
            ) {
              return interaction.reply({
                content:
                  '❌ You already have an active scrim.',

                flags:
                  MessageFlags.Ephemeral
              });
            }

            const scrim = {
              hostId:
                interaction.user.id,

              guildId:
                interaction.guildId,

              channelId:
                interaction.channelId,

              messageId:
                null,

              type:
                null,

              phase:
                'choose',

              players:
                [],

              selected:
                [],

              serverLink:
                null
            };

            const message =
              await interaction.channel.send({
                embeds: [
                  scrimTypeEmbed()
                ],

                components:
                  scrimTypeButtons()
              });

            scrim.messageId =
              message.id;

            scrims.set(
              message.id,
              scrim
            );

            updatePresence();

            return interaction.reply({
              content:
                '✅ Scrim created.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            sub ===
            'announce'
          ) {
            const type =
              interaction.options.getString(
                'type'
              );

            if (
              type ===
                'elo' &&
              !isMainTeam(
                interaction.member
              )
            ) {
              return interaction.reply({
                content:
                  '❌ ELO requires the Main Team role.',

                flags:
                  MessageFlags.Ephemeral
              });
            }

            const unit =
              interaction.options.getString(
                'unit'
              );

            const amount =
              interaction.options.getInteger(
                'amount'
              );

            const key =
              Date.now().toString() +
              Math.random()
                .toString(
                  36
                )
                .slice(
                  2,
                  8
                );

            pendingAnnouncements.set(
              key,
              {
                hostId:
                  interaction.user.id,

                guildId:
                  interaction.guildId,

                channelId:
                  interaction.channelId,

                type:
                  type,

                duration:
                  amount *
                  (
                    unit ===
                    'hours'
                      ? 3600000
                      : 60000
                  )
              }
            );

            const modal =
              new ModalBuilder()
                .setCustomId(
                  `announce_modal:${key}`
                )
                .setTitle(
                  'Scrim Announcement'
                )
                .addComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new TextInputBuilder()
                        .setCustomId(
                          'message'
                        )
                        .setLabel(
                          'Announcement text'
                        )
                        .setStyle(
                          TextInputStyle.Paragraph
                        )
                        .setRequired(
                          false
                        )
                        .setMaxLength(
                          1000
                        )
                    )
                );

            return interaction.showModal(
              modal
            );
          }

          if (
            sub ===
            'results'
          ) {
            const sessionId =
              Date.now().toString() +
              Math.random()
                .toString(
                  36
                )
                .slice(
                  2,
                  10
                );

            resultSessions.set(
              sessionId,
              {
                id:
                  sessionId,

                hostId:
                  interaction.user.id,

                guildId:
                  interaction.guildId,

                club1:
                  '',

                club2:
                  '',

                participants:
                  [],

                rounds:
                  [],

                mvp:
                  null
              }
            );

            const modal =
              new ModalBuilder()
                .setCustomId(
                  `scrim_setup_${sessionId}`
                )
                .setTitle(
                  'Scrim Result'
                )
                .addComponents(
                  new ActionRowBuilder()
                    .addComponents(
                      new TextInputBuilder()
                        .setCustomId(
                          'club1'
                        )
                        .setLabel(
                          'Club 1'
                        )
                        .setStyle(
                          TextInputStyle.Short
                        )
                        .setRequired(
                          true
                        )
                    ),

                  new ActionRowBuilder()
                    .addComponents(
                      new TextInputBuilder()
                        .setCustomId(
                          'club2'
                        )
                        .setLabel(
                          'Club 2'
                        )
                        .setStyle(
                          TextInputStyle.Short
                        )
                        .setRequired(
                          true
                        )
                    )
                );

            return interaction.showModal(
              modal
            );
          }
        }
      }

      /* =====================================
         USER SELECT MENUS
      ===================================== */

      if (
        interaction.isUserSelectMenu()
      ) {

        if (
          interaction.customId ===
          'result_player'
        ) {
          const userId =
            interaction.values[0];

          return interaction.reply({
            embeds: [
              resultTypeEmbed(
                userId
              )
            ],

            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(
                      `result_type:striker:${userId}`
                    )
                    .setLabel(
                      'STRIKER'
                    )
                    .setStyle(
                      ButtonStyle.Primary
                    ),

                  new ButtonBuilder()
                    .setCustomId(
                      `result_type:gk:${userId}`
                    )
                    .setLabel(
                      'GOALKEEPER'
                    )
                    .setStyle(
                      ButtonStyle.Success
                    )
                )
            ],

            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          interaction.customId.startsWith(
            'scrim_participants:'
          )
        ) {
          const sessionId =
            interaction.customId.slice(
              'scrim_participants:'.length
            );

          const result =
            resultSessions.get(
              sessionId
            );

          if (!result) {
            return interaction.reply({
              content:
                '❌ Scrim result session expired. Please use /scrim results again.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          result.participants =
            [
              ...interaction.values
            ];

          return interaction.update({
            embeds: [
              scrimResultEmbed(
                result
              )
            ],

            components:
              scrimResultButtons(
                result
              )
          });
        }

        if (
          interaction.customId.startsWith(
            'result_mvp_player:'
          )
        ) {
          const sessionId =
            interaction.customId.slice(
              'result_mvp_player:'.length
            );

          const result =
            resultSessions.get(
              sessionId
            );

          const userId =
            interaction.values[0];

          if (!result) {
            return interaction.reply({
              content:
                '❌ Scrim result session expired.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            !result.participants.includes(
              userId
            )
          ) {
            return interaction.reply({
              content:
                '❌ MVP must be one of the selected participants.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          return interaction.showModal(
            mvpStatsModal(
              sessionId,
              userId
            )
          );
        }
      }

      /* =====================================
         BUTTONS
      ===================================== */

      if (
        interaction.isButton()
      ) {
        const id =
          interaction.customId;

        /* -----------------------------------
           TRYOUT RESULT TYPE
        ----------------------------------- */

        if (
          id.startsWith(
            'result_type:'
          )
        ) {
          const parts =
            id.split(':');

          return interaction.showModal(
            resultModal(
              parts[1],
              parts[2]
            )
          );
        }

        /* -----------------------------------
           TRYOUT JOIN
        ----------------------------------- */

        if (
          id.startsWith(
            'tryout_join:'
          )
        ) {
          const lobby =
            tryouts.get(
              id.slice(
                'tryout_join:'.length
              )
            );

          if (!lobby) {
            return interaction.reply({
              content:
                '❌ Tryout not found.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            lobby.players.includes(
              interaction.user.id
            )
          ) {
            return interaction.reply({
              content:
                '⚠️ You are already in.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            lobby.players.length >=
            MAX_TRYOUT
          ) {
            return interaction.reply({
              content:
                '❌ Tryout is full.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          lobby.players.push(
            interaction.user.id
          );

          await refreshTryout(
            lobby
          );

          return interaction.reply({
            content:
              '✅ You joined the tryout.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           TRYOUT LEAVE
        ----------------------------------- */

        if (
          id.startsWith(
            'tryout_leave:'
          )
        ) {
          const lobby =
            tryouts.get(
              id.slice(
                'tryout_leave:'.length
              )
            );

          if (!lobby) {
            return interaction.reply({
              content:
                '❌ Tryout not found.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          lobby.players =
            lobby.players.filter(
              userId =>
                userId !==
                interaction.user.id
            );

          await refreshTryout(
            lobby
          );

          return interaction.reply({
            content:
              '✅ You left the tryout.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           TRYOUT SERVER LINK
        ----------------------------------- */

        if (
          id.startsWith(
            'tryout_link:'
          )
        ) {
          const messageId =
            id.slice(
              'tryout_link:'.length
            );

          const lobby =
            tryouts.get(
              messageId
            );

          if (
            !lobby ||
            lobby.hostId !==
              interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const modal =
            new ModalBuilder()
              .setCustomId(
                `tryout_server:${messageId}`
              )
              .setTitle(
                'Tryout Server Link'
              )
              .addComponents(
                new ActionRowBuilder()
                  .addComponents(
                    new TextInputBuilder()
                      .setCustomId(
                        'link'
                      )
                      .setLabel(
                        'Private Server Link'
                      )
                      .setStyle(
                        TextInputStyle.Short
                      )
                      .setRequired(
                        true
                      )
                  )
              );

          return interaction.showModal(
            modal
          );
        }

        /* -----------------------------------
           TRYOUT CLOSE
        ----------------------------------- */

        if (
          id.startsWith(
            'tryout_close:'
          )
        ) {
          const messageId =
            id.slice(
              'tryout_close:'.length
            );

          const lobby =
            tryouts.get(
              messageId
            );

          if (
            !lobby ||
            lobby.hostId !==
              interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          tryouts.delete(
            messageId
          );

          updatePresence();

          return interaction.update({
            embeds: [
              withBanner(
                new EmbedBuilder()
                  .setColor(
                    0xB84949
                  )
                  .setTitle(
                    'TRYOUT CLOSED'
                  )
                  .setDescription(
                    'This tryout has been closed by the host.'
                  )
              )
            ],

            components: []
          });
        }

        /* -----------------------------------
           SCRIM TYPE CLOSE
        ----------------------------------- */

        if (
          id ===
          'scrim_type:close'
        ) {
          return interaction.update({
            content:
              '❌ Scrim cancelled.',
            embeds: [],
            components: []
          });
        }

        /* -----------------------------------
           SCRIM TYPE
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_type:'
          )
        ) {
          const type =
            id.slice(
              'scrim_type:'.length
            );

          if (
            type ===
              'elo' &&
            !isMainTeam(
              interaction.member
            )
          ) {
            return interaction.reply({
              content:
                '❌ ELO requires the Main Team role.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const scrim =
            [
              ...scrims.values()
            ]
              .filter(
                value =>
                  value.hostId ===
                  interaction.user.id
              )
              .at(
                -1
              );

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          scrim.type =
            type;

          const pingRole =
            type ===
              'elo'
              ? ROLES.ELO_PING
              : ROLES.FRIENDLY_PING;

          await interaction.update({
            content:
              mentionRole(
                pingRole
              ),

            embeds: [
              scrimQueueEmbed(
                scrim
              )
            ],

            components:
              scrimQueueButtons(
                scrim
              ),

            allowedMentions: {
              roles: [
                pingRole
              ]
            }
          });

          return;
        }

        /* -----------------------------------
           SCRIM JOIN
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_join:'
          )
        ) {
          const scrim =
            scrims.get(
              id.slice(
                'scrim_join:'.length
              )
            );

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            scrim.players.some(
              player =>
                player.id ===
                interaction.user.id
            )
          ) {
            return interaction.reply({
              content:
                '⚠️ You are already in the queue.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            scrim.players.length >=
            MAX_SCRIM_QUEUE
          ) {
            return interaction.reply({
              content:
                '❌ Queue is full.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          scrim.players.push({
            id:
              interaction.user.id,

            position:
              null
          });

          await refreshScrim(
            scrim
          );

          return interaction.reply({
            content:
              '✅ Joined the scrim queue.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           SCRIM LEAVE
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_leave:'
          )
        ) {
          const scrim =
            scrims.get(
              id.slice(
                'scrim_leave:'.length
              )
            );

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          scrim.players =
            scrim.players.filter(
              player =>
                player.id !==
                interaction.user.id
            );

          await refreshScrim(
            scrim
          );

          return interaction.reply({
            content:
              '✅ You left the queue.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           SCRIM POSITION
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_position:'
          )
        ) {
          const parts =
            id.split(':');

          const position =
            parts[1];

          const scrim =
            scrims.get(
              parts[2]
            );

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const player =
            scrim.players.find(
              p =>
                p.id ===
                interaction.user.id
            );

          if (!player) {
            return interaction.reply({
              content:
                '❌ Join first.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            scrim.players.some(
              p =>
                p.position ===
                  position &&
                p.id !==
                  interaction.user.id
            )
          ) {
            return interaction.reply({
              content:
                '❌ That position is already taken.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          player.position =
            position;

          await refreshScrim(
            scrim
          );

          return interaction.reply({
            content:
              `✅ Position set to ${position}.`,

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           SCRIM SERVER LINK
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_link:'
          )
        ) {
          const messageId =
            id.slice(
              'scrim_link:'.length
            );

          const scrim =
            scrims.get(
              messageId
            );

          if (
            !scrim ||
            scrim.hostId !==
              interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const modal =
            new ModalBuilder()
              .setCustomId(
                `scrim_server:${messageId}`
              )
              .setTitle(
                'Scrim Server Link'
              )
              .addComponents(
                new ActionRowBuilder()
                  .addComponents(
                    new TextInputBuilder()
                      .setCustomId(
                        'link'
                      )
                      .setLabel(
                        'Private Server Link'
                      )
                      .setStyle(
                        TextInputStyle.Short
                      )
                      .setRequired(
                        true
                      )
                  )
              );

          return interaction.showModal(
            modal
          );
        }

        /* -----------------------------------
           SCRIM RANDOM PICK
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_random:'
          )
        ) {
          const messageId =
            id.slice(
              'scrim_random:'.length
            );

          const scrim =
            scrims.get(
              messageId
            );

          if (
            !scrim ||
            scrim.hostId !==
              interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            scrim.players.length <
            RANDOM_PICK_MIN
          ) {
            return interaction.reply({
              content:
                '❌ Random Pick unlocks at 15 players.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          randomPick(
            scrim
          );

          await refreshScrim(
            scrim
          );

          return interaction.reply({
            content:
              '✅ Random lineup selected.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           SCRIM READY
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_ready:'
          )
        ) {
          const parts =
            id.split(':');

          const scrim =
            scrims.get(
              parts[1]
            );

          const userId =
            parts[2];

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            interaction.user.id !==
            userId
          ) {
            return interaction.reply({
              content:
                '❌ This button is not yours.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const player =
            scrim.selected.find(
              p =>
                p.id ===
                userId
            );

          if (!player) {
            return interaction.reply({
              content:
                '❌ You are not selected.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          player.ready =
            !player.ready;

          await refreshScrim(
            scrim
          );

          return interaction.reply({
            content:
              player.ready
                ? '✅ READY.'
                : '✅ NOT READY.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           SCRIM CLOSE
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_close:'
          )
        ) {
          const messageId =
            id.slice(
              'scrim_close:'.length
            );

          const scrim =
            scrims.get(
              messageId
            );

          if (
            !scrim ||
            scrim.hostId !==
              interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          scrims.delete(
            messageId
          );

          updatePresence();

          return interaction.update({
            embeds: [
              withBanner(
                new EmbedBuilder()
                  .setColor(
                    0xB84949
                  )
                  .setTitle(
                    'SCRIM CLOSED'
                  )
                  .setDescription(
                    'This scrim has been closed by the host.'
                  )
              )
            ],

            components: []
          });
        }

        /* -----------------------------------
           ANNOUNCEMENT READY
        ----------------------------------- */

        if (
          id.startsWith(
            'announce_ready:'
          )
        ) {
          const announcement =
            announcements.get(
              id.slice(
                'announce_ready:'.length
              )
            );

          if (!announcement) {
            return interaction.reply({
              content:
                '❌ Announcement not found.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            !announcement.ready.includes(
              interaction.user.id
            )
          ) {
            announcement.ready.push(
              interaction.user.id
            );
          }

          await refreshAnnouncement(
            announcement
          );

          return interaction.reply({
            content:
              '✅ Marked READY.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           ANNOUNCEMENT NOT READY
        ----------------------------------- */

        if (
          id.startsWith(
            'announce_notready:'
          )
        ) {
          const announcement =
            announcements.get(
              id.slice(
                'announce_notready:'.length
              )
            );

          if (!announcement) {
            return interaction.reply({
              content:
                '❌ Announcement not found.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          announcement.ready =
            announcement.ready.filter(
              userId =>
                userId !==
                interaction.user.id
            );

          await refreshAnnouncement(
            announcement
          );

          return interaction.reply({
            content:
              '✅ Marked NOT READY.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           ANNOUNCEMENT RE-PING
        ----------------------------------- */

        if (
          id.startsWith(
            'announce_reping:'
          )
        ) {
          const announcement =
            announcements.get(
              id.slice(
                'announce_reping:'.length
              )
            );

          if (!announcement) {
            return interaction.reply({
              content:
                '❌ Announcement not found.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            announcement.hostId !==
            interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            announcement.reping
          ) {
            return interaction.reply({
              content:
                '⚠️ Re-ping already used.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            !announcement.warning &&
            announcement.phase !==
              'extension'
          ) {
            return interaction.reply({
              content:
                '❌ Re-ping is not available yet.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          announcement.reping =
            true;

          await pingAnnouncement(
            announcement
          );

          await refreshAnnouncement(
            announcement
          );

          return;
        }

        /* -----------------------------------
           SCRIM RESULT - ADD ROUND
        ----------------------------------- */

        if (
          id.startsWith(
            'result_add_round:'
          )
        ) {
          const sessionId =
            id.slice(
              'result_add_round:'.length
            );

          const result =
            resultSessions.get(
              sessionId
            );

          if (!result) {
            return interaction.reply({
              content:
                '❌ Scrim result session expired.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const modal =
            new ModalBuilder()
              .setCustomId(
                `scrim_round_${sessionId}`
              )
              .setTitle(
                'Add Round'
              )
              .addComponents(
                new ActionRowBuilder()
                  .addComponents(
                    new TextInputBuilder()
                      .setCustomId(
                        'score'
                      )
                      .setLabel(
                        'Score'
                      )
                      .setPlaceholder(
                        '5-3'
                      )
                      .setStyle(
                        TextInputStyle.Short
                      )
                      .setRequired(
                        true
                      )
                  )
              );

          return interaction.showModal(
            modal
          );
        }

        /* -----------------------------------
           SCRIM RESULT - MVP
        ----------------------------------- */

        if (
          id.startsWith(
            'result_mvp:'
          )
        ) {
          const sessionId =
            id.slice(
              'result_mvp:'.length
            );

          const result =
            resultSessions.get(
              sessionId
            );

          if (!result) {
            return interaction.reply({
              content:
                '❌ Scrim result session expired.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            !result.participants.length
          ) {
            return interaction.reply({
              content:
                '❌ Select participants first.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          return interaction.reply({
            content:
              '◆ **SELECT MVP**',

            components:
              mvpPlayerSelect(
                sessionId
              ),

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           SCRIM RESULT - FINISH
        ----------------------------------- */

        if (
          id.startsWith(
            'result_finish:'
          )
        ) {
          const sessionId =
            id.slice(
              'result_finish:'.length
            );

          const result =
            resultSessions.get(
              sessionId
            );

          if (!result) {
            return interaction.reply({
              content:
                '❌ Scrim result session expired.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const score1 =
            result.rounds.filter(
              round =>
                round.winner ===
                1
            ).length;

          const score2 =
            result.rounds.filter(
              round =>
                round.winner ===
                2
            ).length;

          if (
            score1 < 3 &&
            score2 < 3
          ) {
            return interaction.reply({
              content:
                '❌ First to 3 rounds is required.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          result.winner =
            score1 > score2
              ? result.club1
              : result.club2;

          result.finishedAt =
            new Date()
              .toISOString();

          scrimResults.push(
            result
          );

          saveJson(
            SCRIM_FILE,
            scrimResults
          );

          resultSessions.delete(
            sessionId
          );

          await interaction.channel.send({
            embeds: [
              publicFinalScrimEmbed(
                result
              )
            ]
          });

          return interaction.update({
            content:
              '✅ **Official scrim result posted publicly.**',

            embeds: [],

            components: []
          });
        }
      }

      /* =====================================
         MODAL SUBMISSIONS
      ===================================== */

      if (
        interaction.isModalSubmit()
      ) {
        const id =
          interaction.customId;

        /* -----------------------------------
           ANNOUNCEMENT MODAL
        ----------------------------------- */

        if (
          id.startsWith(
            'announce_modal:'
          )
        ) {
          const key =
            id.slice(
              'announce_modal:'.length
            );

          const pending =
            pendingAnnouncements.get(
              key
            );

          if (!pending) {
            return interaction.reply({
              content:
                '❌ Announcement session expired.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          pendingAnnouncements.delete(
            key
          );

          const announcement = {
            ...pending,

            messageId:
              null,

            message:
              interaction.fields
                .getTextInputValue(
                  'message'
                )
                .trim(),

            ready:
              [],

            warning:
              false,

            reping:
              false,

            phase:
              'active',

            end:
              Date.now() +
              pending.duration,

            extensionEnd:
              null
          };

          const message =
            await interaction.channel.send({
              embeds: [
                announcementEmbed(
                  announcement
                )
              ],

              components:
                announcementButtons({
                  ...announcement,
                  messageId:
                    'pending'
                })
            });

          announcement.messageId =
            message.id;

          announcements.set(
            message.id,
            announcement
          );

          await refreshAnnouncement(
            announcement
          );

          await pingAnnouncement(
            announcement
          );

          return interaction.reply({
            content:
              '✅ Announcement created.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           TRYOUT SERVER MODAL
        ----------------------------------- */

        if (
          id.startsWith(
            'tryout_server:'
          )
        ) {
          const messageId =
            id.slice(
              'tryout_server:'.length
            );

          const lobby =
            tryouts.get(
              messageId
            );

          if (
            !lobby ||
            lobby.hostId !==
              interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const link =
            interaction.fields
              .getTextInputValue(
                'link'
              )
              .trim();

          if (
            !/^https:\/\/\S+$/i.test(
              link
            )
          ) {
            return interaction.reply({
              content:
                '❌ Invalid HTTPS link.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          lobby.serverLink =
            link;

          await refreshTryout(
            lobby
          );

          return interaction.reply({
            content:
              '✅ Server link saved.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           SCRIM SERVER MODAL
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_server:'
          )
        ) {
          const messageId =
            id.slice(
              'scrim_server:'.length
            );

          const scrim =
            scrims.get(
              messageId
            );

          if (
            !scrim ||
            scrim.hostId !==
              interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const link =
            interaction.fields
              .getTextInputValue(
                'link'
              )
              .trim();

          if (
            !/^https:\/\/\S+$/i.test(
              link
            )
          ) {
            return interaction.reply({
              content:
                '❌ Invalid HTTPS link.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          scrim.serverLink =
            link;

          await refreshScrim(
            scrim
          );

          return interaction.reply({
            content:
              '✅ Server link saved.',

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           TRYOUT RESULT STATS
        ----------------------------------- */

        if (
          id.startsWith(
            'result_stats:'
          )
        ) {
          const parts =
            id.split(':');

          const type =
            parts[1];

          const userId =
            parts[2];

          const labels =
            type === 'gk'
              ? [
                  'Goalkeeping',
                  'Reaction Time',
                  'Passing',
                  'Defending'
                ]
              : [
                  'Shooting',
                  'Passing',
                  'Teamwork',
                  'Defending'
                ];

          const stats =
            {};

          for (
            let index = 0;
            index < labels.length;
            index++
          ) {
            const score =
              validStat(
                interaction.fields
                  .getTextInputValue(
                    `stat_${index + 1}`
                  )
              );

            if (
              score ===
              null
            ) {
              return interaction.reply({
                content:
                  `❌ ${labels[index]} must be from 0 to 10.`,

                flags:
                  MessageFlags.Ephemeral
              });
            }

            stats[
              labels[index]
            ] =
              score;
          }

          const current =
            calculateOVR(
              stats
            );

          const old =
            getPlayerData(
              userId
            );

          const best =
            Math.max(
              old.highestScore,
              current
            );

          const fixes =
            interaction.fields
              .getTextInputValue(
                'fixes'
              )
              .trim();

          players[userId] = {
            schemaVersion:
              6,

            currentScore:
              current,

            highestScore:
              best,

            bestResult:
              `${best}/10`,

            history:
              old.history
                .concat({
                  type:
                    type,

                  stats:
                    stats,

                  currentScore:
                    current,

                  highestScore:
                    best,

                  thingsToFix:
                    fixes,

                  createdAt:
                    new Date()
                      .toISOString(),

                  hostId:
                    interaction.user.id
                })
                .slice(
                  -50
                ),

            updatedAt:
              new Date()
                .toISOString()
          };

          saveJson(
            PLAYER_FILE,
            players
          );

          const member =
            await interaction.guild.members
              .fetch(
                userId
              )
              .catch(
                () =>
                  null
              );

          if (
            member
          ) {
            await setOVRRole(
              member,
              current
            );
          }

          return interaction.reply({
            embeds: [
              finalTryoutEmbed(
                userId,
                current,
                `${best}/10`,
                stats,
                fixes
              )
            ],

            allowedMentions: {
              users: [
                userId
              ],

              roles:
                OVR_ROLES[current]
                  ? [
                      OVR_ROLES[
                        current
                      ]
                    ]
                  : []
            }
          });
        }

        /* -----------------------------------
           SCRIM SETUP
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_setup_'
          )
        ) {
          const sessionId =
            id.slice(
              'scrim_setup_'.length
            );

          const result =
            resultSessions.get(
              sessionId
            );

          if (!result) {
            return interaction.reply({
              content:
                '❌ Scrim result session expired. Please use /scrim results again.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          result.club1 =
            interaction.fields
              .getTextInputValue(
                'club1'
              )
              .trim();

          result.club2 =
            interaction.fields
              .getTextInputValue(
                'club2'
              )
              .trim();

          return interaction.reply({
            embeds: [
              scrimResultEmbed(
                result
              )
            ],

            components: [
              new ActionRowBuilder()
                .addComponents(
                  new UserSelectMenuBuilder()
                    .setCustomId(
                      `scrim_participants:${sessionId}`
                    )
                    .setPlaceholder(
                      'Select up to 5 participants'
                    )
                    .setMinValues(
                      1
                    )
                    .setMaxValues(
                      5
                    )
                )
            ],

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           SCRIM ROUND
        ----------------------------------- */

        if (
          id.startsWith(
            'scrim_round_'
          )
        ) {
          const sessionId =
            id.slice(
              'scrim_round_'.length
            );

          const result =
            resultSessions.get(
              sessionId
            );

          if (!result) {
            return interaction.reply({
              content:
                '❌ Scrim result session expired.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            result.rounds.length >=
            6
          ) {
            return interaction.reply({
              content:
                '❌ Maximum 6 rounds.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const match =
            /^(\d+)\s*-\s*(\d+)$/.exec(
              interaction.fields
                .getTextInputValue(
                  'score'
                )
                .trim()
            );

          if (!match) {
            return interaction.reply({
              content:
                '❌ Use this format: 5-3',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const s1 =
            Number(
              match[1]
            );

          const s2 =
            Number(
              match[2]
            );

          if (
            s1 ===
            s2
          ) {
            return interaction.reply({
              content:
                '❌ A round cannot be a draw.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          result.rounds.push({
            round:
              result.rounds.length +
              1,

            s1:
              s1,

            s2:
              s2,

            winner:
              s1 > s2
                ? 1
                : 2
          });

          return interaction.reply({
            embeds: [
              scrimResultEmbed(
                result
              )
            ],

            components:
              scrimResultButtons(
                result
              ),

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* -----------------------------------
           SCRIM MVP STATS
        ----------------------------------- */

        if (
          id.startsWith(
            'result_mvp_stats:'
          )
        ) {
          const parts =
            id.split(':');

          const sessionId =
            parts[1];

          const userId =
            parts[2];

          const result =
            resultSessions.get(
              sessionId
            );

          if (!result) {
            return interaction.reply({
              content:
                '❌ Scrim result session expired.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          const goals =
            Number(
              interaction.fields
                .getTextInputValue(
                  'goals'
                )
            );

          const roundsPlayed =
            Number(
              interaction.fields
                .getTextInputValue(
                  'rounds'
                )
            );

          if (
            !Number.isInteger(
              goals
            ) ||
            goals < 0 ||
            !Number.isInteger(
              roundsPlayed
            ) ||
            roundsPlayed < 1 ||
            roundsPlayed > 6
          ) {
            return interaction.reply({
              content:
                '❌ Invalid MVP values.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            !result.participants.includes(
              userId
            )
          ) {
            return interaction.reply({
              content:
                '❌ MVP must be one of the selected participants.',

              flags:
                MessageFlags.Ephemeral
            });
          }

          result.mvp = {
            userId:
              userId,

            goals:
              goals,

            roundsPlayed:
              roundsPlayed
          };

          return interaction.reply({
            embeds: [
              scrimResultEmbed(
                result
              )
            ],

            components:
              scrimResultButtons(
                result
              ),

            flags:
              MessageFlags.Ephemeral
          });
        }
      }
    } catch (
      error
    ) {
      console.error(
        'Interaction error:',
        error
      );

      try {
        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp({
            content:
              '❌ Something went wrong. Check the console.',

            flags:
              MessageFlags.Ephemeral
          });
        } else {
          await interaction.reply({
            content:
              '❌ Something went wrong. Check the console.',

            flags:
              MessageFlags.Ephemeral
          });
        }
      } catch {}
    }
  }
);

/* =========================================
   ANNOUNCEMENT TIMER
========================================= */

setInterval(
  async () => {
    const now =
      Date.now();

    for (
      const [
        messageId,
        announcement
      ] of announcements
    ) {
      try {
        if (
          announcement.phase ===
          'active'
        ) {
          const remaining =
            announcement.end -
            now;

          if (
            remaining <=
              WARNING_MS &&
            remaining > 0
          ) {
            announcement.warning =
              true;

            await refreshAnnouncement(
              announcement
            );
          }

          if (
            remaining <=
            0
          ) {
            announcement.phase =
              'extension';

            announcement.warning =
              true;

            announcement.extensionEnd =
              now +
              EXTENSION_MS;

            await refreshAnnouncement(
              announcement
            );
          }
        } else if (
          announcement.phase ===
          'extension'
        ) {
          if (
            now >=
            announcement.extensionEnd
          ) {
            try {
              const channel =
                await client.channels.fetch(
                  announcement.channelId
                );

              const message =
                await channel.messages.fetch(
                  messageId
                );

              await message.edit({
                embeds: [
                  withBanner(
                    new EmbedBuilder()
                      .setColor(
                        0xB84949
                      )
                      .setTitle(
                        'ANNOUNCEMENT CLOSED'
                      )
                      .setDescription(
                        `**READY:** ${announcement.ready.length}/${MAX_TRYOUT}`
                      )
                  )
                ],

                components: []
              });
            } catch {}

            announcements.delete(
              messageId
            );
          } else {
            await refreshAnnouncement(
              announcement
            );
          }
        }
      } catch (
        error
      ) {
        console.error(
          'Announcement timer error:',
          error.message
        );
      }
    }
  },
  5000
);

/* =========================================
   READY
========================================= */

client.once(
  'ready',
  async () => {
    console.log(
      '================================'
    );

    console.log(
      '✅ AZURE OF THE LATCH BOT ONLINE'
    );

    console.log(
      `🤖 ${client.user.tag}`
    );

    console.log(
      '================================'
    );

    updatePresence();

    try {
      await registerCommands();

      console.log(
        '✅ Commands registered successfully.'
      );
    } catch (
      error
    ) {
      console.error(
        '❌ Command registration failed:',
        error.message
      );
    }
  }
);

client.on(
  'error',
  error => {
    console.error(
      'Discord error:',
      error
    );
  }
);

process.on(
  'unhandledRejection',
  error => {
    console.error(
      'Unhandled rejection:',
      error
    );
  }
);

if (!TOKEN) {
  console.error(
    '❌ TOKEN missing from .env'
  );

  process.exit(
    1
  );
}

client
  .login(
    TOKEN
  )
  .catch(
    error => {
      console.error(
        '❌ Login failed:',
        error.message
      );
    }
  );
