const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

const clientPath = path.join(__dirname, "..", "client");

app.use(express.static(clientPath));


// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(clientPath, "index.html")
    );

});


// ======================================================
// ROOMS
// ======================================================

const rooms = new Map();


// ======================================================
// GENERATE ROOM CODE
// ======================================================

function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {

        code = "";

        for (let i = 0; i < 6; i++) {

            const index =
                Math.floor(
                    Math.random() * characters.length
                );

            code += characters[index];

        }

    } while (rooms.has(code));

    return code;
}


// ======================================================
// PLAYBACK STATE HELPERS
// ======================================================

function getLivePlaybackState(room) {

    const state = room?.playbackState;

    if (!state) {
        return null;
    }

    const result = { ...state };

    if (result.isPlaying) {
        const elapsed =
            (Date.now() - (result.updatedAt || Date.now())) / 1000;

        result.currentTime =
            Math.max(0, Number(result.currentTime || 0) + elapsed);
    }

    return result;
}


function savePlaybackState(room, patch = {}) {

    room.playbackState = {
        ...room.playbackState,
        ...patch,
        currentTime: Math.max(0, Number(patch.currentTime ?? room.playbackState.currentTime ?? 0)),
        updatedAt: Date.now()
    };

    return getLivePlaybackState(room);
}


// ======================================================
// SOCKET.IO
// ======================================================

io.on("connection", (socket) => {

    console.log("");
    console.log("=================================");
    console.log("USER CONNECTED");
    console.log("Socket:", socket.id);
    console.log("=================================");


    // ==================================================
    // CREATE ROOM
    // ==================================================

    socket.on("create-room", (data) => {

        console.log("");
        console.log("CREATE ROOM REQUEST:");
        console.log(data);


        const userName =
            data?.userName?.trim();

        const roomName =
            data?.roomName?.trim();


        if (!userName || !roomName) {

            socket.emit(
                "room-error",
                "Name and room name are required."
            );

            return;
        }


        const roomCode =
            generateRoomCode();


        const room = {

            code: roomCode,

            name: roomName,

            users: [

                {
                    name: userName,

                    socketId: socket.id,

                    online: true

                }

            ],

            playbackState: {
                mediaType: null,
                videoId: null,
                playlistId: null,
                playlistIndex: 0,
                isPlaying: false,
                currentTime: 0,
                updatedAt: Date.now()
            }

        };


        rooms.set(
            roomCode,
            room
        );


        socket.join(
            roomCode
        );


        socket.data.roomCode =
            roomCode;

        socket.data.userName =
            userName;


        console.log("");
        console.log("=================================");
        console.log("ROOM CREATED");
        console.log("Code:", roomCode);
        console.log("Name:", roomName);
        console.log("Creator:", userName);
        console.log("=================================");


        socket.emit(
            "room-created",
            {

                roomCode:
                    roomCode,

                roomName:
                    roomName,

                userName:
                    userName

            }
        );

    });


    // ==================================================
    // RESTORE ROOM
    // ==================================================

    socket.on("restore-room", (data) => {

        console.log("");
        console.log("=================================");
        console.log("RESTORE ROOM REQUEST");
        console.log("Data:", data);
        console.log("=================================");


        const roomCode =
            data?.roomCode
                ?.trim()
                .toUpperCase();


        const userName =
            data?.userName
                ?.trim();


        if (!roomCode || !userName) {

            console.log(
                "Restore rejected: missing data"
            );

            return;
        }


        const room =
            rooms.get(roomCode);


        if (!room) {

            console.log(
                "Restore failed: room not found",
                roomCode
            );


            socket.emit(
                "room-error",
                "This room no longer exists."
            );

            return;
        }


        // ------------------------------------------------
        // FIND EXISTING USER
        // ------------------------------------------------

        const existingUser =
            room.users.find(
                user =>
                    user.name === userName
            );


        if (existingUser) {

            // Reconnect same person
            existingUser.socketId =
                socket.id;

            existingUser.online =
                true;

        } else {

            // If room has two people already
            if (room.users.length >= 2) {

                socket.emit(
                    "room-error",
                    "This room is full."
                );

                return;
            }


            room.users.push({

                name:
                    userName,

                socketId:
                    socket.id,

                online:
                    true

            });

        }


        socket.join(
            roomCode
        );


        socket.data.roomCode =
            roomCode;

        socket.data.userName =
            userName;


        console.log("");
        console.log("=================================");
        console.log("ROOM RESTORED");
        console.log("Room:", roomCode);
        console.log("User:", userName);
        console.log("Users:", room.users);
        console.log("=================================");


        socket.emit(
            "room-restored",
            {

                roomCode:
                    room.code,

                roomName:
                    room.name,

                users:
                    room.users.map(
                        user =>
                            user.name
                    ),

                playbackState:
                    getLivePlaybackState(room)

            }
        );


        // Tell the other person
        socket
            .to(roomCode)
            .emit(
                "user-joined",
                {

                    userName:
                        userName,

                    users:
                        room.users.map(
                            user =>
                                user.name
                        )

                }
            );

    });


    // ==================================================
    // JOIN ROOM
    // ==================================================

    socket.on("join-room", (data) => {

        console.log("");
        console.log("=================================");
        console.log("JOIN ROOM REQUEST RECEIVED");
        console.log("Socket:", socket.id);
        console.log("Data:", data);
        console.log("=================================");


        const roomCode =
            data?.roomCode
                ?.trim()
                .toUpperCase();


        const userName =
            data?.userName
                ?.trim();


        if (!roomCode || !userName) {

            socket.emit(
                "join-error",
                "Please enter your name and room code."
            );

            return;
        }


        const room =
            rooms.get(roomCode);


        console.log(
            "Looking for room:",
            roomCode
        );


        if (!room) {

            console.log(
                "JOIN REJECTED: ROOM NOT FOUND"
            );


            socket.emit(
                "join-error",
                "Room not found. Please check the code."
            );

            return;
        }


        console.log(
            "Room found:",
            room
        );


        // ------------------------------------------------
        // CHECK IF SAME USER IS ALREADY IN ROOM
        // ------------------------------------------------

        const existingUser =
            room.users.find(
                user =>
                    user.name === userName
            );


        if (existingUser) {

            existingUser.socketId =
                socket.id;

            existingUser.online =
                true;

        } else {

            // ------------------------------------------------
            // MAX 2 PEOPLE
            // ------------------------------------------------

            if (room.users.length >= 2) {

                console.log(
                    "JOIN REJECTED: ROOM FULL"
                );


                socket.emit(
                    "join-error",
                    "This room is already full."
                );

                return;
            }


            room.users.push({

                name:
                    userName,

                socketId:
                    socket.id,

                online:
                    true

            });

        }


        socket.join(
            roomCode
        );


        socket.data.roomCode =
            roomCode;

        socket.data.userName =
            userName;


        console.log("");
        console.log("=================================");
        console.log("JOIN SUCCESS");
        console.log("Room:", roomCode);
        console.log("User:", userName);
        console.log("Users:", room.users);
        console.log("=================================");


        // ------------------------------------------------
        // TELL JOINER
        // ------------------------------------------------

        socket.emit(
            "room-joined",
            {

                roomCode:
                    roomCode,

                roomName:
                    room.name,

                userName:
                    userName,

                users:
                    room.users.map(
                        user =>
                            user.name
                    ),

                playbackState:
                    getLivePlaybackState(room)

            }
        );


        // ------------------------------------------------
        // TELL CREATOR
        // ------------------------------------------------

        socket
            .to(roomCode)
            .emit(
                "user-joined",
                {

                    userName:
                        userName,

                    users:
                        room.users.map(
                            user =>
                                user.name
                        )

                }
            );

    });


    // ==================================================
    // MEDIA LOAD / PLAYBACK SYNC
    // ==================================================

    socket.on("media-load", (data) => {

        const roomCode = socket.data.roomCode;
        const room = rooms.get(roomCode);

        if (!room || !data?.mediaType) {
            return;
        }

        const state = savePlaybackState(room, {
            mediaType: data.mediaType,
            videoId: data.mediaType === "video" ? data.videoId : null,
            playlistId: data.mediaType === "playlist" ? data.playlistId : null,
            playlistIndex: Number.isInteger(Number(data.playlistIndex))
                ? Number(data.playlistIndex)
                : 0,
            isPlaying: data.isPlaying !== false,
            currentTime: Number(data.time) || 0
        });

        console.log("MEDIA LOAD SYNC", roomCode, state);

        socket.to(roomCode).emit("playback-state", state);

    });


    socket.on("playback-action", (data) => {

        const roomCode = socket.data.roomCode;
        const room = rooms.get(roomCode);

        if (!room || !data?.action) {
            return;
        }

        const current = room.playbackState || {};
        const action = data.action;

        const patch = {
            currentTime: Number(data.time) || 0
        };

        if (data.mediaType) {
            patch.mediaType = data.mediaType;
        }

        if (data.videoId !== undefined) {
            patch.videoId = data.videoId;
        }

        if (data.playlistId !== undefined) {
            patch.playlistId = data.playlistId;
        }

        if (Number.isInteger(Number(data.playlistIndex))) {
            patch.playlistIndex = Number(data.playlistIndex);
        }

        if (action === "play") {
            patch.isPlaying = true;
        }

        if (action === "pause") {
            patch.isPlaying = false;
        }

        if (action === "seek") {
            patch.isPlaying = current.isPlaying;
        }

        if (action === "track") {
            patch.isPlaying = true;
            patch.currentTime = 0;
        }

        const state = savePlaybackState(room, patch);

        console.log("PLAYBACK SYNC", roomCode, action, state);

        socket.to(roomCode).emit("playback-state", state);

    });


    // ==================================================
    // DISCONNECT
    // ==================================================

    socket.on("disconnect", (reason) => {

        console.log("");
        console.log("=================================");
        console.log("USER DISCONNECTED");
        console.log("Socket:", socket.id);
        console.log("Reason:", reason);
        console.log("=================================");


        const roomCode =
            socket.data.roomCode;


        const userName =
            socket.data.userName;


        if (!roomCode || !userName) {

            return;
        }


        const room =
            rooms.get(roomCode);


        if (!room) {

            return;
        }


        // ------------------------------------------------
        // IMPORTANT
        // ------------------------------------------------
        //
        // DO NOT REMOVE USER.
        //
        // Browser navigation can disconnect a socket
        // temporarily. We keep the user in the room
        // and allow restore-room to reconnect them.
        //

        const user =
            room.users.find(
                item =>
                    item.socketId === socket.id
            );


        if (user) {

            user.socketId =
                null;

            user.online =
                false;

        }


        console.log(
            `Socket disconnected from room ${roomCode}, but user remains in room.`
        );


        console.log(
            "Current room users:",
            room.users
        );


        // Don't tell the other person yet.
        //
        // The user may simply be moving from
        // room-created.html to room.html.

    });

});


// ======================================================
// START SERVER
// ======================================================

const PORT = 3000;

server.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            `Between Us is running at http://localhost:${PORT}`
        );
        console.log("");

    }
);