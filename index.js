const express = require("express");
const app = express();
const port = 3000;
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
app.get("/", (req, res) => {
  res.send("Still alive!")
})

// URL a la que se hará la petición cada 10 minutos
const URL_OBJETIVO = "https://bot-armada-sc.onrender.com";

// Función para hacer la petición
const hacerPeticion = async () => {
    try {
        const respuesta = await axios.get(URL_OBJETIVO);
        console.log(`Petición exitosa:`, respuesta.data);
    } catch (error) {
        console.error(`Error en la petición:`, error.message);
    }
};

// Inicia el intervalo cada 10 minutos (600,000 ms)
setInterval(hacerPeticion, 600000);

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");
const { log } = require("console");

// IDs específicas
const ID_CANAL_PAGOS = "1329100520844951602";
const ID_CATEGORIA_CONTABILIDAD = "1329859690384855091";

// Crear cliente del bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});
client.login(
  process.env.TOKEN
);

client.once("ready", () => {
  console.log(`¡Bot conectado como ${client.user.tag}!`);
});

//Comandos
const comandos = {
  nuevaMision: "nueva expedicion",
  meApunto: "me apunto",
  retirada: "retirada",
  cerrarMision: "cerrar",
  abrirMision: "abrir",
  listado: "listado",
  finalizarMision: "finalizar expedicion",
};

// Variables globales
let misionesActivas = {}; // Almacena las misiones activas por creador

//Ejecuciones de comandos entrantes entrantes
client.on("messageCreate", async (_message) => {
  if (_message.author.bot) return;

  //Setear variables de ejecucion
  let message = _message;

  let mission = Object.values(misionesActivas).find(
    (m) => m.canalId === "" + message.channel.id,
  );
  if (mission?.finalizada) {
    message.channel.send(
      "La expedición ya está finalizada. Avisa a un administrador para cerrar este canal.",
    );
    return;
  }
  let mentionedUsers = message.mentions.users;

  //Crear nueva misión
  if (
    !Object.values(misionesActivas).some(
      (m) => m.canalId === message.channel.id,
    ) &&
    checkearComando(comandos.nuevaMision, message, mission, mentionedUsers)
  ) {
    crearNuevaMision(message, mission, mentionedUsers);
    return;
  } else if (
    !Object.values(misionesActivas).some(
      (m) => m.canalId === message.channel.id,
    )
  ) {
    return;
  }

  //Comprobacion de mision.listoConfirmado
  if (!mission.listoConfirmado) {
    //Ejecuciones de mision no listoConfirmado

    //Apuntar participantes
    if (
      mentionedUsers.size > 0 ||
      checkearComando(comandos.meApunto, message, mission, mentionedUsers)
    ) {
      apuntarParticipanteParaMisionActiva(message, mission, mentionedUsers);
      return;
    }

    //Cerrar mision
    if (
      checkearComando(
        comandos.cerrarMision,
        message,
        mission,
        mentionedUsers,
      ) &&
      checkearQueEscribeParticipanteDeMision(message, mission, mentionedUsers)
    ) {
      cerrarMision(message, mission, mentionedUsers);
      return;
    }

    message.channel.send(
      `Comando no reconocido, la expedicion sigue abierta. Prueba a cerrar la expedición escribiendo "cerrar"`,
    );
  } else {
    //Ejecuciones de mision listoConfirmado

    //Limitamos que los comandos de mision solo los puedan ejecutar los participantes
    if (
      !checkearQueEscribeParticipanteDeMision(message, mission, mentionedUsers)
    ) {
      return message.reply(
        "No estás registrado en esta expedición. No puedes ejecutar comandos.",
      );
    }

    //Abrir mision
    if (
      checkearComando(comandos.abrirMision, message, mission, mentionedUsers)
    ) {
      abrirMision(message, mission, mentionedUsers);
      return;
    }

    //Registrar carga
    const cargaRegex = /^(-?\d+)\s+(.+)$/;
    const matchCarga = message.content.match(cargaRegex);
    if (matchCarga) {
      registrarCarga(matchCarga, message, mission, mentionedUsers);
      return;
    }

    //TODO: Eliminar carga
    /*if (message.content.toLowerCase() === "eliminar anterior") {

    if (mission && mission.cargas.length > 0) {
      const lastCarga = mission.cargas[mission.cargas.length - 1];
      if (lastCarga.count > 1) {
        lastCarga.count -= 1;
      } else {
        mission.cargas.pop();
      }
      return message.reply(
        `Se eliminó 1 unidad de ${lastCarga.scu} SCU de ${lastCarga.material}.`
      );
    } else {
      return message.reply("No hay carga para eliminar.");
    }
  }*/

    //Cambiar nombre carga
    const cambiarRegex = /^cambiar\s+(\S+)\s+(\S+)$/;
    const matchCambiar = message.content.match(cambiarRegex);
    if (matchCambiar) {
      cambiarNombreMaterial(matchCambiar, message, mission, mentionedUsers);
      return;
    }

    //Registrar precio
    const precioRegex = /^precio\s+(.+)\s+(\d+)$/;
    const matchPrecio = message.content.match(precioRegex);
    if (matchPrecio) {
      registrarPrecio(matchPrecio, message, mission, mentionedUsers);
      return;
    }

    //Listar estado actual
    if (checkearComando(comandos.listado, message, mission, mentionedUsers)) {
      listarMision(message, mission, mentionedUsers);
      return;
    }

    //Finalizar mision
    if (
      checkearComando(
        comandos.finalizarMision,
        message,
        mission,
        mentionedUsers,
      )
    ) {
      finalizarMision(message, mission, mentionedUsers);
      return;
    }

    //Retirar participante
    if (
      checkearComando(comandos.retirada, message, mission, mentionedUsers) ||
      message.content.toLowerCase().includes("retirada")
    ) {
      retirarParticipante(message, mission, mentionedUsers);
      return;
    }
  }
});

/* ----- FUNCIONES SEPARADAS ----- */

function checkearComando(comando, message, mission, mentionedUsers) {
  return message.content.toLowerCase().trim() === comando;
}

async function crearNuevaMision(message, mission, mentionedUsers) {
  if (misionesActivas[message.author.id]) {
    return message.reply(
      "Ya tienes una misión activa. Finalízala antes de crear otra.",
    );
  }

  // Crear canal para la misión dentro de la categoría específica
  const canalMision = await message.guild.channels.create({
    name: `expedición-de-${message.author.username}`,
    type: ChannelType.GuildText,
    parent: ID_CATEGORIA_CONTABILIDAD,
    permissionOverwrites: [
      {
        id: message.guild.roles.everyone.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
        ],
      },
    ],
  });

  misionesActivas[message.author.id] = {
    canalId: canalMision.id,
    participantes: [message.author],
    cargas: [],
    listoConfirmado: false,
    finalizada: false,
    preciosPendientes: true,
    retirados: [],
  };

  canalMision.send(
    `¡Nueva expedición creada por ${message.author.username}! Menciona a los participantes con "@nombre" para registrarlos o escribe "me apunto" para unirte. Cuando todos estén registrados, escribe "cerrar" para confirmar que están todos y comenzar a cargar materiales.`,
  );
  message.reply(`Expedición creada en el canal ${canalMision}.`);
}

function checkearQueEscribeParticipanteDeMision(
  message,
  mission,
  mentionedUsers,
) {
  return mission
    ? mission.participantes.find((p) => p.id === message.author.id)
    : false;
}

function apuntarParticipanteParaMisionActiva(message, mission, mentionedUsers) {
  if (mentionedUsers.size > 0) {
    mentionedUsers.forEach((user) => {
      if (!mission.participantes.find((p) => p.id === user.id)) {
        mission.participantes.push(user);
        if (mission.retirados.find((p) => p.id === user.id)) {
          const retiradoIndex = mission.retirados.findIndex(
            (p) => p.id === user.id,
          );
          mission.retirados.splice(retiradoIndex, 1);
        }
        message.channel.send(
          `¡${user.username} ha sido añadido a la expedición!`,
        );
      } else {
        message.channel.send(
          `${user.username} ya está registrado en la expedición.`,
        );
      }
    });
  } else if (
    checkearComando(comandos.meApunto, message, mission, mentionedUsers)
  ) {
    if (!mission.participantes.find((p) => p.id === message.author.id)) {
      mission.participantes.push(message.author);
      message.reply(`¡Bienvenido a la expedición, ${message.author.username}!`);
    } else {
      message.reply("Ya estás en la expedición.");
    }
  }
}

function retirarParticipante(message, mission, mentionedUsers) {
  const userToRemove =
    mentionedUsers.size > 0 ? mentionedUsers.first() : message.author;

  const participantIndex = mission.participantes.findIndex(
    (p) => p.id === userToRemove.id,
  );
  if (participantIndex !== -1) {
    mission.retirados.push(userToRemove);
    mission.participantes.splice(participantIndex, 1);
    message.channel.send(
      `¡${userToRemove.username} ha sido retirado! Su parte proporcional se calculará al finalizar la misión.`,
    );
    return;
  } else {
    message.reply(
      `${userToRemove.username} no está registrado en la expedición.`,
    );
    return;
  }
}

function cerrarMision(message, mission, mentionedUsers) {
  if (mission.participantes.length === 0) {
    return message.reply(
      "No hay participantes registrados. Asegúrate de añadirlos antes de continuar.",
    );
  }
  mission.listoConfirmado = true;
  message.reply(
    '¡Están todos listos! Misión cerrada. Ahora pueden comenzar a cargar materiales usando el formato "[cantidad] [material]".',
  );
}

function abrirMision(message, mission, mentionedUsers) {
  mission.listoConfirmado = false;
  message.reply(
    'Mision abierta. Menciona a los participantes con "@nombre" para registrarlos o escribe "me apunto" para unirte. Cuando todos estén registrados, escribe "cerrar" para confirmar que están todos y comenzar a cargar materiales.',
  );
}

function registrarCarga(match, message, mission, mentionedUsers) {
  const [_, scu, material] = match;

  mission.cargas.push({
    material: material,
    scu: parseInt(scu),
    participantes: mission.participantes.map((p) => p),
  });
  message.reply(
    `Carga registrada: ${scu} SCU de ${material}. \n` +
      imprimirCargaTotal(message, mission, mentionedUsers),
  );
}

function registrarPrecio(match, message, mission, mentionedUsers) {
  let [_, material, precio] = match;

  material = material.toLowerCase();
  precio = parseFloat(precio);

  if (!material || isNaN(precio)) {
    return message.reply('Formato inválido. Usa "precio [material] [precio]".');
  }

  const cargasActualizadas = mission.cargas.filter(
    (c) => c.material.toLowerCase() === material,
  );
  if (cargasActualizadas.length > 0) {
    cargasActualizadas.forEach((carga) => (carga.precio = precio));
    message.reply(
      `Precio registrado para ${material}: ${precio} aUEC/scu aplicado a todas las cargas. \n ` +
        imprimirCargaTotal(message, mission, mentionedUsers),
    );
  } else {
    message.reply(
      "Material no encontrado. Asegúrate de haber registrado el material antes.",
    );
  }
}

function cambiarNombreMaterial(match, message, mission, mentionedUsers) {
  const [_, materialMal, materialBien] = match;

  if (!materialMal || !materialBien) {
    return message.reply(
      'Formato inválido. Usa "cambiar [material mal] [material bien]".',
    );
  }

  const cargasActualizadas = mission.cargas.filter(
    (c) => c.material.toLowerCase() === materialMal,
  );

  if (cargasActualizadas.length > 0) {
    cargasActualizadas.forEach((carga) => (carga.material = materialBien));
    message.reply(
      `Material ${materialMal} modificado a ${materialBien}. \n ` +
        imprimirCargaTotal(message, mission, mentionedUsers),
    );
  } else {
    message.reply(
      `Material ${materialMal} no encontrado. Asegúrate de usar "cambiar [material mal] [material bien].`,
    );
  }
}

function listarMision(message, mission, mentionedUsers) {
  const listaCargas =
    imprimirCargaTotal(message, mission, mentionedUsers) ||
    "No hay cargas registradas.";
  const participantesActivos =
    mission.participantes.map((p) => `<@${p.id}>`).join(", ") || "Ninguno";
  const participantesRetirados =
    mission.retirados.map((r) => `<@${r.id}>`).join(", ") || "Ninguno";

  message.channel.send(
    `**Estado Actual de la Expedición:**\n\n` +
      `${listaCargas}\n\n` +
      `**Participantes Activos:** ${participantesActivos}\n` +
      `**Participantes Retirados:** ${participantesRetirados}`,
  );
}

function agruparCargasDeMision(message, mission, mentionedUsers) {
  let cargasAgrupadas = [];
  let result = [];
  mission.cargas.forEach((c) => {
    if (!cargasAgrupadas.includes(c.material.toLowerCase())) {
      cargasAgrupadas.push(c.material.toLowerCase());
      result.push(
        contarCargasMismoTipo(
          c.material.toLowerCase(),
          message,
          mission,
          mentionedUsers,
        ),
      );
    }
  });
  return result;
}

function contarCargasMismoTipo(material, message, mission, mentionedUsers) {
  let cantidadSCUMaterial = 0;
  let precio = undefined;

  mission.cargas.forEach((c) => {
    if (c.material.toLowerCase() === material.toLowerCase()) {
      cantidadSCUMaterial += c.scu;
      if (c.precio) precio = c.precio;
    }
  });

  let result = {};
  result.material = material.toLowerCase();
  result.scu = cantidadSCUMaterial;
  if (precio) result.precio = precio;

  return result;
}

function imprimirCargaTotal(message, mission, mentionedUsers) {
  const totalCarga = mission.cargas.reduce((sum, c) => sum + c.scu, 0);

  return (
    `Carga actual: \n
${agruparCargasDeMision(message, mission, mentionedUsers)
  .map(
    (c) =>
      `${c.scu} SCU de ${c.material} ${c.precio ? "a " + c.precio + "aUEC/scu" : ""}`,
  )
  .join("\n")}
` + `\nTotal SCU: ${totalCarga} SCU.\n`
  );
}

async function finalizarMision(message, mission, mentionedUsers) {
  //Comprobacion de materiales sin precio
  const materialesSinPrecio = mission.cargas.filter(
    (c) => c.precio === undefined,
  );
  if (materialesSinPrecio.length > 0) {
    return message.reply(
      `Faltan precios para los siguientes materiales: ${materialesSinPrecio
        .map((c) => c.material)
        .join(
          ", ",
        )}. Usa "precio [material] [precio]" para registrar los precios.`,
    );
  }
  //Calculos generales
  const total = mission.cargas.reduce((acc, c) => acc + c.scu * c.precio, 0);
  const organizacion = total * 0.1;
  const repartoParticipantesYRetirados = [];
  mission.participantes.forEach((p) => {
    repartoParticipantesYRetirados.push({
      ...p,
      neto: 0,
      comision: 0,
      bruto: 0,
    });
  });
  mission.retirados.forEach((r) => {
    repartoParticipantesYRetirados.push({
      ...r,
      neto: 0,
      comision: 0,
      bruto: 0,
    });
  });
  mission.cargas.forEach((c) => {
    c.participantes.forEach((p) => {
      repartoParticipantesYRetirados.map((user) => {
        if (user.id == p.id) {
          let valorCarga = c.scu * c.precio;
          let comisionOrganizacion = valorCarga * 0.1;
          let neto =
            (valorCarga - comisionOrganizacion) / c.participantes.length;
          user.neto += neto;
          user.comision += neto * 0.005;
        }
      });
    });
  });

  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("📦 Expedición Finalizada 📦")
    .setDescription("Detalles de la expedición:")
    .addFields(
      {
        name: "Participantes",
        value:
          repartoParticipantesYRetirados.map((p) => `<@${p.id}>`).join(", ") ||
          "Ninguno",
      },
      {
        name: "Cargas",
        value:
          imprimirCargaTotal(message, mission, mentionedUsers) ||
          "Sin cargas registradas",
      },
      {
        name: "Total (100%)",
        value: `${total.toFixed(2)} aUEC`,
      },
      {
        name: "Total a repartir (90%)",
        value: `${(total - organizacion).toFixed(2)} aUEC`,
      },
      {
        name: "Total organización (10%)",
        value: `${organizacion.toFixed(2)} aUEC`,
      },
      {
        name: "Reparto por Persona",
        value:
          repartoParticipantesYRetirados
            .map(
              (r) =>
                `<@${r.id}>: Neto ${r.neto.toFixed(
                  2,
                )} aUEC, Comisión ${r.comision.toFixed(
                  2,
                )} aUEC, Final ${(r.neto - r.comision).toFixed(2)} aUEC`,
            )
            .join("\n") || "Ninguno",
      },
    )
    .setTimestamp();

  const canalPagos = message.guild.channels.cache.get(ID_CANAL_PAGOS);
  if (canalPagos) {
    canalPagos.send({ embeds: [embed] });
  } else {
    message.reply(
      "No se encontró el canal de pagos. Por favor verifica la configuración.",
    );
  }
  mission.finalizada = true;
  message.channel.send(
    "Expedición finalizada. Avisa a un administrador para cerrar este canal.",
  );
  // const canalMision = message.guild.channels.cache.get(mission.canalId);
  //if (canalMision) await canalMision.delete();

  for (const key in misionesActivas) {
    if (misionesActivas[key].canalId == mission.canalId) {
      delete misionesActivas[key];
      break;
    }
  }
}

//TODO: añadir precios al listado
//TODO: añadir mensajes a acciones no comandos
//TODO: Peta al cerrar una expedicion teniendo otra simultanea abierta
