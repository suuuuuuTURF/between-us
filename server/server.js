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

            playlist: [],

            playback: {
                currentIndex: 0,
                isPlaying: false,
                currentTime: 0,
                updatedAt: Date.now()
            },

            users: [

                {
                    name: userName,

                    socketId: socket.id,

                    online: true

                }

            ]

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

                playlist:
                    room.playlist.slice(),

                currentIndex:
                    room.playback.currentIndex,

                isPlaying:
                    room.playback.isPlaying,

                currentTime:
                    room.playback.currentTime,

                updatedAt:
                    room.playback.updatedAt

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

                playlist:
                    room.playlist.slice(),

                currentIndex:
                    room.playback.currentIndex,

                isPlaying:
                    room.playback.isPlaying,

                currentTime:
                    room.playback.currentTime,

                updatedAt:
                    room.playback.updatedAt

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
    // SHARED PLAYLIST
    // ==================================================

    socket.on("add-to-shared-playlist", (data) => {

        const roomCode =
            data?.roomCode?.trim().toUpperCase();

        const room = rooms.get(roomCode);

        if (!room || socket.data.roomCode !== roomCode) {
            return;
        }

        const incoming = Array.isArray(data?.videoIds)
            ? data.videoIds
            : [];

        const valid = incoming.filter(
            id => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id)
        );

        const previousLength = room.playlist.length;
        const existing = new Set(room.playlist);

        for (const videoId of valid) {
            if (!existing.has(videoId)) {
                room.playlist.push(videoId);
                existing.add(videoId);
            }
        }

        if (!room.playlist.length) {
            return;
        }

        if (room.playback.currentIndex >= room.playlist.length) {
            room.playback.currentIndex = 0;
            room.playback.currentTime = 0;
        }

        const wasEmptyBefore =
            previousLength === 0 && room.playlist.length > 0;

        if (wasEmptyBefore) {
            room.playback.currentIndex = 0;
            room.playback.currentTime = 0;
            room.playback.isPlaying = true;
        }

        room.playback.updatedAt = Date.now();

        io.to(roomCode).emit(
            "shared-playlist-updated",
            {
                playlist: room.playlist.slice(),
                currentIndex: room.playback.currentIndex,
                isPlaying: room.playback.isPlaying,
                currentTime: room.playback.currentTime,
                updatedAt: room.playback.updatedAt
            }
        );

    });


    // ==================================================
    // SERVER-AUTHORITATIVE PLAYBACK
    // ==================================================

    socket.on("shared-playback-command", (data) => {

        const roomCode =
            data?.roomCode?.trim().toUpperCase();

        const room = rooms.get(roomCode);

        if (!room || socket.data.roomCode !== roomCode) {
            return;
        }

        const action = data?.action;

        if (!room.playlist.length) {
            return;
        }

        const requestedIndex = Number.isInteger(data?.index)
            ? data.index
            : room.playback.currentIndex;

        const safeIndex = Math.max(
            0,
            Math.min(requestedIndex, room.playlist.length - 1)
        );

        if (action === "ended") {

            // Only the client that reports the currently active index
            // can advance the room. If both browsers report ENDED, the
            // second report is ignored because the index has already moved.
            if (safeIndex !== room.playback.currentIndex) {
                return;
            }

            if (room.playlist.length === 1) {
                room.playback.currentIndex = 0;
                room.playback.currentTime = 0;
                room.playback.isPlaying = false;
            } else if (room.playback.currentIndex < room.playlist.length - 1) {
                room.playback.currentIndex += 1;
                room.playback.currentTime = 0;
                room.playback.isPlaying = true;
            } else {
                room.playback.currentIndex = 0;
                room.playback.currentTime = 0;
                room.playback.isPlaying = false;
            }

            room.playback.updatedAt = Date.now();

        } else {

            if (action === "index") {
                room.playback.currentIndex = safeIndex;
                room.playback.currentTime = 0;
                room.playback.isPlaying = true;
            }

            if (action === "play") {
                const currentTime = Number(data?.currentTime);
                room.playback.currentIndex = safeIndex;
                if (Number.isFinite(currentTime)) {
                    room.playback.currentTime = Math.max(0, currentTime);
                }
                room.playback.isPlaying = true;
            }

            if (action === "pause") {
                const currentTime = Number(data?.currentTime);
                room.playback.currentIndex = safeIndex;
                if (Number.isFinite(currentTime)) {
                    room.playback.currentTime = Math.max(0, currentTime);
                }
                room.playback.isPlaying = false;
            }

            if (action === "seek") {
                const currentTime = Number(data?.currentTime);
                room.playback.currentIndex = safeIndex;
                if (Number.isFinite(currentTime)) {
                    room.playback.currentTime = Math.max(0, currentTime);
                }
            }

            if (!["index", "play", "pause", "seek"].includes(action)) {
                return;
            }

            room.playback.updatedAt = Date.now();

        }

        io.to(roomCode).emit(
            "shared-playback-updated",
            {
                playlist: room.playlist.slice(),
                currentIndex: room.playback.currentIndex,
                isPlaying: room.playback.isPlaying,
                currentTime: room.playback.currentTime,
                updatedAt: room.playback.updatedAt
            }
        );

    });


    // ==================================================
    // PLAYBACK HEARTBEAT
    // ==================================================

    socket.on("shared-playback-heartbeat", (data) => {

        const roomCode =
            data?.roomCode?.trim().toUpperCase();

        const room = rooms.get(roomCode);

        if (!room || socket.data.roomCode !== roomCode) {
            return;
        }

        if (!room.playlist.length || !room.playback.isPlaying) {
            return;
        }

        const index = Number.isInteger(data?.index)
            ? data.index
            : room.playback.currentIndex;

        if (index !== room.playback.currentIndex) {
            return;
        }

        const currentTime = Number(data?.currentTime);

        if (!Number.isFinite(currentTime)) {
            return;
        }

        room.playback.currentTime = Math.max(0, currentTime);
        room.playback.updatedAt = Date.now();

    });


    // ==================================================
    // LEAVE ROOM
    // ==================================================

    socket.on("leave-room", (data) => {

        const roomCode =
            data?.roomCode
                ?.trim()
                .toUpperCase();

        if (!roomCode) {
            return;
        }

        const room =
            rooms.get(roomCode);

        if (!room) {
            return;
        }

        // Make sure this socket actually belongs
        // to the requested room.
        if (
            socket.data.roomCode !==
            roomCode
        ) {
            return;
        }

        const userName =
            socket.data.userName;

        // Remove only this user.
        room.users =
            room.users.filter(
                user =>
                    user.socketId !==
                    socket.id
            );

        // Tell the remaining person.
        socket
            .to(roomCode)
            .emit(
                "user-left",
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

        // Leave the Socket.IO room.
        socket.leave(roomCode);

        // Clear this socket's room data.
        socket.data.roomCode = null;
        socket.data.userName = null;

        console.log("");
        console.log(
            "================================="
        );
        console.log(
            "USER LEFT ROOM"
        );
        console.log(
            "Room:",
            roomCode
        );
        console.log(
            "User:",
            userName
        );
        console.log(
            "Remaining users:",
            room.users
        );
        console.log(
            "================================="
        );

        /*
         * Do NOT delete the room here.
         *
         * The room and its playlist/playback state
         * remain available for the remaining user.
         */
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

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Between Us is running on port ${PORT}`);
});