// ======================================================
// BETWEEN US
// APP.JS
// ======================================================


// ======================================================
// GLOBAL STATE
// ======================================================

let socket = null;
let socketReady = false;

let player = null;
let youtubeAPIReady = false;
let playerReady = false;

let currentMediaType = null;
let currentVideoId = null;
let currentPlaylistId = null;

// Shared room queue. The server is the source of truth.
let sharedPlaylist = [];
let roomCodeForSync = null;
let applyingSharedPlaylist = false;
let discoveringYouTubePlaylist = false;
let pendingRoomState = null;
let applyingRemotePlayback = false;
let lastServerPlaybackUpdatedAt = 0;
let playbackHeartbeatTimer = null;

// Holds the exact server playback position until
// YouTube confirms that the requested video is ready.
let pendingPlaybackRestore = null;

let progressTimer = null;
let metadataTimer = null;

let isSeeking = false;

const videoMetadataCache = new Map();


// ======================================================
// SOCKET.IO
// ======================================================

if (typeof io !== "undefined") {

    socket = io({
        transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {

        socketReady = true;

        console.log("Connected:", socket.id);

        updateConnectionStatus("connected");

    });

    socket.on("disconnect", (reason) => {

        socketReady = false;

        console.log("Disconnected:", reason);

        updateConnectionStatus("disconnected");

    });

    socket.on("connect_error", (error) => {

        socketReady = false;

        console.error("Socket error:", error);

        updateConnectionStatus("error");

    });

} else {

    console.error("Socket.IO not loaded.");

}


// ======================================================
// CONNECTION STATUS
// ======================================================

function updateConnectionStatus(status) {

    const connectionStatus =
        document.getElementById("connectionStatus");

    const joinConnectionStatus =
        document.getElementById("joinConnectionStatus");

    const roomStatus =
        document.getElementById("roomStatus");

    let text = "";

    if (status === "connected") {
        text = "Connected ♡";
    }

    if (status === "disconnected") {
        text = "Connection lost. Reconnecting...";
    }

    if (status === "error") {
        text = "Unable to connect.";
    }

    if (connectionStatus) {
        connectionStatus.textContent = text;
    }

    if (joinConnectionStatus) {
        joinConnectionStatus.textContent = text;
    }

    if (
        roomStatus &&
        status !== "connected"
    ) {
        roomStatus.textContent = text;
    }

}


// ======================================================
// CREATE ROOM
// ======================================================

const createRoomForm =
    document.getElementById("createRoomForm");


if (createRoomForm) {

    createRoomForm.addEventListener(
        "submit",
        (event) => {

            event.preventDefault();

            const userName =
                document
                    .getElementById("userName")
                    ?.value
                    .trim();

            const roomName =
                document
                    .getElementById("roomName")
                    ?.value
                    .trim();

            if (!userName) {
                alert("Please enter your name.");
                return;
            }

            if (!roomName) {
                alert("Please enter a room name.");
                return;
            }

            if (!socket) {
                alert("Server connection unavailable.");
                return;
            }

            const button =
                createRoomForm.querySelector(
                    "button[type='submit']"
                );

            if (button) {

                button.disabled = true;
                button.textContent = "Creating...";

            }

            socket.emit(
                "create-room",
                {
                    userName,
                    roomName
                }
            );

        }
    );

}


// ======================================================
// ROOM CREATED
// ======================================================

if (socket) {

    socket.on(
        "room-created",
        (roomData) => {

            console.log(
                "Room created:",
                roomData
            );

            localStorage.setItem(
                "betweenUsUserName",
                roomData.userName
            );

            localStorage.setItem(
                "betweenUsRoomName",
                roomData.roomName
            );

            localStorage.setItem(
                "betweenUsRoomCode",
                roomData.roomCode
            );

            window.location.href =
                "room-created.html" +
                "?code=" +
                encodeURIComponent(
                    roomData.roomCode
                ) +
                "&name=" +
                encodeURIComponent(
                    roomData.roomName
                );

        }
    );

}


// ======================================================
// ROOM ERROR
// ======================================================

if (socket) {

    socket.on(
        "room-error",
        (message) => {

            console.error(
                "Room error:",
                message
            );

            if (
                document.getElementById(
                    "roomStatus"
                )
            ) {

                showRoomMessage(message);

            } else {

                alert(message);

            }

            resetCreateButton();

        }
    );

}


function resetCreateButton() {

    const button =
        createRoomForm?.querySelector(
            "button[type='submit']"
        );

    if (button) {

        button.disabled = false;
        button.textContent = "Create Room";

    }

}


// ======================================================
// JOIN ROOM
// ======================================================

const joinRoomForm =
    document.getElementById("joinRoomForm");


if (joinRoomForm) {

    joinRoomForm.addEventListener(
        "submit",
        (event) => {

            event.preventDefault();

            const userName =
                document
                    .getElementById("joinUserName")
                    ?.value
                    .trim();

            const roomCode =
                document
                    .getElementById("joinRoomCode")
                    ?.value
                    .trim()
                    .toUpperCase();

            if (!userName) {

                alert(
                    "Please enter your name."
                );

                return;

            }

            if (
                !roomCode ||
                roomCode.length !== 6
            ) {

                alert(
                    "Please enter a valid 6-character room code."
                );

                return;

            }

            if (!socket) {

                alert(
                    "Server connection unavailable."
                );

                return;

            }

            const button =
                joinRoomForm.querySelector(
                    "button[type='submit']"
                );

            if (button) {

                button.disabled = true;
                button.textContent = "Joining...";

            }

            const join = () => {

                console.log(
                    "Joining room:",
                    roomCode
                );

                socket.emit(
                    "join-room",
                    {
                        roomCode,
                        userName
                    }
                );

            };

            if (socketReady) {

                join();

            } else {

                socket.once(
                    "connect",
                    join
                );

            }

        }
    );

}


// ======================================================
// JOIN SUCCESS
// ======================================================

if (socket) {

    socket.on(
        "room-joined",
        (roomData) => {

            console.log(
                "Joined:",
                roomData
            );

            localStorage.setItem(
                "betweenUsUserName",
                roomData.userName
            );

            localStorage.setItem(
                "betweenUsRoomName",
                roomData.roomName
            );

            localStorage.setItem(
                "betweenUsRoomCode",
                roomData.roomCode
            );

            window.location.href =
                "room.html?code=" +
                encodeURIComponent(
                    roomData.roomCode
                );

        }
    );

}


// ======================================================
// JOIN ERROR
// ======================================================

if (socket) {

    socket.on(
        "join-error",
        (message) => {

            console.error(
                "Join error:",
                message
            );

            alert(message);

            resetJoinButton();

        }
    );

}


function resetJoinButton() {

    const button =
        joinRoomForm?.querySelector(
            "button[type='submit']"
        );

    if (button) {

        button.disabled = false;
        button.textContent = "Join Room";

    }

}


// ======================================================
// ROOM PAGE INITIALIZATION
// ======================================================

const peopleList =
    document.getElementById("peopleList");


if (
    peopleList &&
    socket
) {

    initializeRoom();

}


function initializeRoom() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const roomCode =
        params.get("code");

    roomCodeForSync = roomCode;

    const userName =
        localStorage.getItem(
            "betweenUsUserName"
        );

    const roomName =
        localStorage.getItem(
            "betweenUsRoomName"
        );

    if (!roomCode) {

        updateRoomStatus(
            "Room unavailable"
        );

        showRoomMessage(
            "No room code was provided."
        );

        return;

    }

    if (!userName) {

        updateRoomStatus(
            "Session unavailable"
        );

        return;

    }

    const codeElement =
        document.getElementById(
            "currentRoomCode"
        );

    if (codeElement) {

        codeElement.textContent =
            roomCode;

    }

    const titleElement =
        document.getElementById(
            "roomTitle"
        );

    if (
        titleElement &&
        roomName
    ) {

        titleElement.textContent =
            roomName;

    }

    const restore = () => {

        socket.emit(
            "restore-room",
            {
                roomCode,
                userName
            }
        );

    };

    if (socketReady) {

        restore();

    } else {

        socket.once(
            "connect",
            restore
        );

    }

}


// ======================================================
// ROOM RESTORED
// ======================================================

if (socket) {

    socket.on(
        "room-restored",
        (roomData) => {

            console.log(
                "Room restored:",
                roomData
            );

            updateRoomHeader(
                roomData
            );

            renderUsers(
                roomData.users
            );

            updateRoomStatus(
                getRoomStatusText(
                    roomData.users
                )
            );

            // Server owns the shared queue.
            if (Array.isArray(roomData.playlist)) {
                sharedPlaylist = roomData.playlist.slice();
            }

            pendingRoomState = roomData;
            applyPendingRoomState();

        }
    );

}


// ======================================================
// SHARED PLAYLIST / ROOM STATE
// ======================================================

if (socket) {

    socket.on(
        "shared-playlist-updated",
        (data) => {

            console.log("Shared playlist updated:", data);

            if (Array.isArray(data?.playlist)) {
                sharedPlaylist = data.playlist.slice();
            }

            if (!player || !playerReady) {
                pendingRoomState = data;
                return;
            }

            applySharedPlaylist(
                sharedPlaylist,
                Number.isInteger(data?.currentIndex)
                    ? data.currentIndex
                    : 0,
                false,
                getAuthoritativeTime(data),
                data?.isPlaying === true
            );

        }
    );

}


if (socket) {

    socket.on(
        "shared-playback-updated",
        (state) => {

            console.log("Authoritative playback state:", state);

            if (Array.isArray(state?.playlist)) {
                const incoming = state.playlist.slice();
                if (incoming.join("|") !== sharedPlaylist.join("|")) {
                    sharedPlaylist = incoming;
                }
            }

            if (!player || !playerReady) {
                pendingRoomState = {
                    ...(pendingRoomState || {}),
                    ...state,
                    playlist: Array.isArray(state?.playlist)
                        ? state.playlist.slice()
                        : sharedPlaylist.slice()
                };
                return;
            }

            applyAuthoritativePlayback(state);

        }
    );

}


function getAuthoritativeTime(state) {

    const base = Number(state?.currentTime);

    if (!Number.isFinite(base)) {
        return 0;
    }

    if (state?.isPlaying !== true) {
        return Math.max(0, base);
    }

    const updatedAt = Number(state?.updatedAt);

    if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
        return Math.max(0, base);
    }

    return Math.max(
        0,
        base + Math.max(0, Date.now() - updatedAt) / 1000
    );
}


function applyAuthoritativePlayback(state) {

    if (!player || !playerReady) {
        return;
    }

    const playlist = Array.isArray(state?.playlist)
        ? state.playlist.slice()
        : sharedPlaylist.slice();

    const safeIndex = playlist.length
        ? Math.max(0, Math.min(
            Number.isInteger(state?.currentIndex) ? state.currentIndex : 0,
            playlist.length - 1
        ))
        : 0;

    const targetTime = getAuthoritativeTime(state);
    const currentIndex = getCurrentSharedIndex();
    const samePlaylist =
        playlist.length === sharedPlaylist.length &&
        playlist.join("|") === sharedPlaylist.join("|");

    lastServerPlaybackUpdatedAt = Number(state?.updatedAt) || Date.now();

    applyingRemotePlayback = true;

    try {
        if (!samePlaylist || !playlist.length) {
            sharedPlaylist = playlist;
            if (playlist.length) {
                applySharedPlaylist(
                    playlist,
                    safeIndex,
                    false,
                    targetTime,
                    state?.isPlaying === true
                );
            }
            return;
        }

        currentMediaType = playlist.length > 1 ? "playlist" : "video";
        currentVideoId = playlist[safeIndex] || null;
        currentPlaylistId = null;

        if (currentIndex !== safeIndex) {
            player.playVideoAt(safeIndex);
        }

        setTimeout(() => {
            try {
                player.seekTo(targetTime, true);
                if (state?.isPlaying === true) {
                    player.playVideo();
                } else {
                    player.pauseVideo();
                }
                updateNowPlaying();
                renderQueue();
            } catch (error) {
                console.error("Could not apply authoritative playback:", error);
            } finally {
                applyingRemotePlayback = false;
            }
        }, currentIndex !== safeIndex ? 350 : 0);

    } catch (error) {
        console.error("Playback sync error:", error);
        applyingRemotePlayback = false;
    }
}


function applyPendingRoomState() {

    if (!pendingRoomState || !player || !playerReady) {
        return;
    }

    const state = pendingRoomState;
    pendingRoomState = null;

    if (Array.isArray(state.playlist) && state.playlist.length) {
        sharedPlaylist = state.playlist.slice();
        applySharedPlaylist(
            sharedPlaylist,
            Number.isInteger(state.currentIndex)
                ? state.currentIndex
                : 0,
            false,
            getAuthoritativeTime(state),
            state.isPlaying === true
        );
    }

}


function applySharedPlaylist(
    playlist,
    index = 0,
    shouldPlay = false,
    startTime = 0,
    explicitPlaying = null
) {
    if (!player || !playerReady) {
        return;
    }

    const clean = Array.from(
        new Set(
            (Array.isArray(playlist) ? playlist : [])
                .filter(
                    id =>
                        /^[A-Za-z0-9_-]{11}$/.test(id)
                )
        )
    );

    sharedPlaylist = clean;

    if (!clean.length) {
        applyingSharedPlaylist = false;
        applyingRemotePlayback = false;
        pendingPlaybackRestore = null;
        return;
    }

    const safeIndex = Math.max(
        0,
        Math.min(
            Number.isInteger(index) ? index : 0,
            clean.length - 1
        )
    );

    const targetTime =
        Number.isFinite(Number(startTime))
            ? Math.max(0, Number(startTime))
            : 0;

    const shouldStart =
        explicitPlaying === true ||
        (explicitPlaying === null && shouldPlay);

    applyingSharedPlaylist = true;
    applyingRemotePlayback = true;

    currentMediaType =
        clean.length > 1
            ? "playlist"
            : "video";

    currentPlaylistId = null;
    currentVideoId = clean[safeIndex];

    // Wait for YouTube to cue the requested video before seeking.
    pendingPlaybackRestore = {
        index: safeIndex,
        time: targetTime,
        shouldPlay: shouldStart
    };

    try {
        player.loadPlaylist({
            playlist: clean,
            index: safeIndex
        });
    } catch (error) {
        console.error(
            "Could not load shared playlist:",
            error
        );

        applyingSharedPlaylist = false;
        applyingRemotePlayback = false;
        pendingPlaybackRestore = null;

        return;
    }

    setPlaylistIndicator(
        clean.length > 1
            ? "Shared playlist"
            : "Single song"
    );

    updateAlbumArt(
        clean[safeIndex]
    );

    updateMusicControls();

    // Fallback in case CUED is delayed.
    setTimeout(() => {
        if (
            !pendingPlaybackRestore ||
            !player ||
            !playerReady
        ) {
            return;
        }

        const restore =
            pendingPlaybackRestore;

        try {
            const currentIndex =
                getCurrentSharedIndex();

            if (
                currentIndex ===
                restore.index
            ) {
                if (restore.time > 0) {
                    player.seekTo(
                        restore.time,
                        true
                    );
                }

                if (restore.shouldPlay) {
                    player.playVideo();
                } else {
                    player.pauseVideo();
                }

                pendingPlaybackRestore = null;
                applyingSharedPlaylist = false;

                setTimeout(() => {
                    applyingRemotePlayback = false;
                }, 500);
            }
        } catch (error) {
            console.error(
                "Playback restore fallback failed:",
                error
            );
        }
    }, 1800);
}


// ======================================================
// USER JOINED
// ======================================================

if (socket) {

    socket.on(
        "user-joined",
        (data) => {

            console.log(
                "User joined:",
                data
            );

            renderUsers(
                data.users
            );

            updateRoomStatus(
                getRoomStatusText(
                    data.users
                )
            );

            showRoomMessage(
                `${data.userName} joined the room ♡`
            );

        }
    );

}


// ======================================================
// USER LEFT
// ======================================================

if (socket) {

    socket.on(
        "user-left",
        (data) => {

            console.log(
                "User left:",
                data
            );

            renderUsers(
                data.users
            );

            updateRoomStatus(
                getRoomStatusText(
                    data.users
                )
            );

        }
    );

}


// ======================================================
// ROOM HEADER
// ======================================================

function updateRoomHeader(roomData) {

    const codeElement =
        document.getElementById(
            "currentRoomCode"
        );

    const titleElement =
        document.getElementById(
            "roomTitle"
        );

    if (
        codeElement &&
        roomData.roomCode
    ) {

        codeElement.textContent =
            roomData.roomCode;

    }

    if (
        titleElement &&
        roomData.roomName
    ) {

        titleElement.textContent =
            roomData.roomName;

    }

}


// ======================================================
// USERS
// ======================================================

function renderUsers(users) {

    const list =
        document.getElementById(
            "peopleList"
        );

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (
        !users ||
        !users.length
    ) {
        return;
    }

    users.forEach(
        (user) => {

            const name =
                typeof user === "string"
                    ? user
                    : user.name;

            const person =
                document.createElement(
                    "div"
                );

            person.className =
                "person";

            const avatar =
                document.createElement(
                    "div"
                );

            avatar.className =
                "person-avatar";

            avatar.textContent =
                getInitial(name);

            const nameElement =
                document.createElement(
                    "span"
                );

            nameElement.className =
                "person-name";

            nameElement.textContent =
                name;

            person.appendChild(
                avatar
            );

            person.appendChild(
                nameElement
            );

            list.appendChild(
                person
            );

        }
    );

}


function getInitial(name) {

    if (!name) {
        return "?";
    }

    return name
        .charAt(0)
        .toUpperCase();

}


function getRoomStatusText(users) {

    if (
        !users ||
        users.length < 2
    ) {

        return "Waiting for your person...";

    }

    return "Together now ♡";

}


function updateRoomStatus(message) {

    const element =
        document.getElementById(
            "roomStatus"
        );

    if (element) {

        element.textContent =
            message;

    }

}


function showRoomMessage(message) {

    const element =
        document.getElementById(
            "roomMessage"
        );

    if (element) {

        element.textContent =
            message;

    }

}


// ======================================================
// ROOM CREATED PAGE
// ======================================================

const roomCreatedCode =
    document.getElementById(
        "roomCode"
    );

const roomCreatedName =
    document.getElementById(
        "displayRoomName"
    );


if (roomCreatedCode) {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const code =
        params.get("code");

    if (code) {

        roomCreatedCode.textContent =
            code;

    }

}


if (roomCreatedName) {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const name =
        params.get("name");

    if (name) {

        roomCreatedName.textContent =
            name;

    }

}


// ======================================================
// COPY ROOM CODE
// ======================================================

const copyCodeButton =
    document.getElementById(
        "copyCodeButton"
    );


if (copyCodeButton) {

    copyCodeButton.addEventListener(
        "click",
        async () => {

            const code =
                document
                    .getElementById(
                        "roomCode"
                    )
                    ?.textContent
                    .trim();

            if (
                !code ||
                code === "------"
            ) {

                return;

            }

            try {

                await navigator.clipboard.writeText(
                    code
                );

                const message =
                    document.getElementById(
                        "copyMessage"
                    );

                if (message) {

                    message.textContent =
                        "Room code copied ♡";

                    setTimeout(
                        () => {

                            message.textContent =
                                "";

                        },
                        2000
                    );

                }

            } catch (error) {

                console.error(
                    "Copy error:",
                    error
                );

            }

        }
    );

}


// ======================================================
// SHARE LINK
// ======================================================

const shareLink =
    document.getElementById(
        "shareLink"
    );


if (shareLink) {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const code =
        params.get("code");

    if (code) {

        shareLink.textContent =
            `${window.location.origin}/join-room.html?code=${code}`;

    }

}


// ======================================================
// COPY SHARE LINK
// ======================================================

const copyLinkButton =
    document.getElementById(
        "copyLinkButton"
    );


if (copyLinkButton) {

    copyLinkButton.addEventListener(
        "click",
        async () => {

            const link =
                document
                    .getElementById(
                        "shareLink"
                    )
                    ?.textContent
                    .trim();

            if (
                !link ||
                link === "Creating your link..."
            ) {

                return;

            }

            try {

                await navigator.clipboard.writeText(
                    link
                );

                copyLinkButton.textContent =
                    "Copied!";

                setTimeout(
                    () => {

                        copyLinkButton.textContent =
                            "Copy";

                    },
                    2000
                );

            } catch (error) {

                console.error(
                    "Copy error:",
                    error
                );

            }

        }
    );

}


// ======================================================
// YOUTUBE API
// ======================================================

window.onYouTubeIframeAPIReady =
    function () {

        console.log(
            "YouTube API ready."
        );

        youtubeAPIReady = true;

        createYouTubePlayer();

    };


// ======================================================
// CREATE YOUTUBE PLAYER
// ======================================================

function createYouTubePlayer() {

    const container =
        document.getElementById(
            "youtubePlayer"
        );

    if (!container) {
        return;
    }

    if (
        typeof YT === "undefined" ||
        !YT.Player
    ) {

        return;

    }

    if (player) {
        return;
    }

    player =
        new YT.Player(
            "youtubePlayer",
            {

                width: "100%",

                height: "100%",

                playerVars: {

                    playsinline: 1,

                    controls: 1,

                    rel: 0

                },

                events: {

                    onReady:
                        onYouTubePlayerReady,

                    onStateChange:
                        onYouTubePlayerStateChange,

                    onError:
                        onYouTubePlayerError

                }

            }
        );

}


function onYouTubePlayerReady() {

    console.log(
        "YouTube player ready."
    );

    playerReady = true;

    updateMusicControls();
    applyPendingRoomState();

}


// ======================================================
// YOUTUBE STATE
// ======================================================

function onYouTubePlayerStateChange(event) {

    updateMusicControls();

    if (
        event.data ===
        YT.PlayerState.PLAYING
    ) {

        startProgressTimer();
        startMetadataRefresh();
        startPlaybackHeartbeat();
        updateNowPlaying();

    }

    if (
        event.data ===
        YT.PlayerState.PAUSED
    ) {

        stopProgressTimer();
        stopPlaybackHeartbeat();
        updateNowPlaying();

    }

    if (
        event.data ===
        YT.PlayerState.CUED
    ) {

        updateNowPlaying();

        if (
            pendingPlaybackRestore &&
            player &&
            playerReady
        ) {
            const restore =
                pendingPlaybackRestore;

            try {
                const currentIndex =
                    getCurrentSharedIndex();

                if (
                    currentIndex ===
                    restore.index
                ) {
                    // YouTube has now cued the requested video.
                    // Restore the exact server-authoritative position.
                    if (restore.time > 0) {
                        player.seekTo(
                            restore.time,
                            true
                        );
                    }

                    if (restore.shouldPlay) {
                        player.playVideo();
                    } else {
                        player.pauseVideo();
                    }

                    pendingPlaybackRestore = null;
                    applyingSharedPlaylist = false;

                    setTimeout(() => {
                        applyingRemotePlayback = false;
                    }, 500);

                    console.log(
                        "Playback restored:",
                        {
                            index: restore.index,
                            time: restore.time,
                            playing: restore.shouldPlay
                        }
                    );
                }
            } catch (error) {
                console.error(
                    "Could not restore authoritative timestamp:",
                    error
                );
            }
        }
    }

    if (
        event.data ===
        YT.PlayerState.ENDED
    ) {

        stopProgressTimer();
        stopPlaybackHeartbeat();
        updateNowPlaying();

        if (
            !applyingRemotePlayback &&
            socket &&
            roomCodeForSync &&
            sharedPlaylist.length
        ) {
            socket.emit(
                "shared-playback-command",
                {
                    roomCode: roomCodeForSync,
                    action: "ended",
                    index: getCurrentSharedIndex()
                }
            );
        }

    }

}


// ======================================================
// YOUTUBE ERROR
// ======================================================

function onYouTubePlayerError(event) {

    console.error(
        "YouTube error:",
        event.data
    );

    const messages = {

        2:
            "Invalid YouTube link.",

        5:
            "This video cannot be played here.",

        100:
            "This video is unavailable.",

        101:
            "This video cannot be embedded.",

        150:
            "This video cannot be embedded."

    };

    showYouTubeError(
        messages[event.data] ||
        "This YouTube video could not be played."
    );

}


// ======================================================
// YOUTUBE INPUT
// ======================================================

const youtubeUrl =
    document.getElementById(
        "youtubeUrl"
    );

const loadYoutubeButton =
    document.getElementById(
        "loadYoutubeButton"
    );


if (
    youtubeUrl &&
    loadYoutubeButton
) {

    loadYoutubeButton.addEventListener(
        "click",
        loadYouTubeFromInput
    );

    youtubeUrl.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                loadYouTubeFromInput();

            }

        }
    );

}


// ======================================================
// LOAD YOUTUBE
// ======================================================

function loadYouTubeFromInput() {

    const value =
        youtubeUrl?.value.trim();

    if (!value) {

        showYouTubeError(
            "Paste a YouTube link first."
        );

        return;

    }

    const media =
        parseYouTubeURL(value);

    if (!media) {

        showYouTubeError(
            "That doesn't look like a valid YouTube link."
        );

        return;

    }

    clearYouTubeError();

    if (
        !youtubeAPIReady ||
        !player ||
        !playerReady
    ) {

        showYouTubeError(
            "YouTube player is still loading."
        );

        return;

    }

    if (media.type === "playlist") {

        loadYouTubePlaylist(media.playlistId);

    } else {

        addVideoToSharedQueue(media.videoId);

    }

}


// ======================================================
// PARSE YOUTUBE URL
// ======================================================

function parseYouTubeURL(value) {

    let url;

    try {

        url =
            new URL(value);

    } catch {

        return null;

    }

    const hostname =
        url.hostname
            .replace(
                "www.",
                ""
            )
            .toLowerCase();

    const playlistId =
        url.searchParams.get(
            "list"
        );

    if (playlistId) {

        return {

            type:
                "playlist",

            playlistId

        };

    }

    let videoId = null;

    if (
        hostname ===
        "youtu.be"
    ) {

        videoId =
            url.pathname
                .replace(
                    "/",
                    ""
                )
                .split("/")[0];

    }

    if (
        hostname === "youtube.com" ||
        hostname === "m.youtube.com"
    ) {

        videoId =
            url.searchParams.get(
                "v"
            );

        if (
            !videoId &&
            url.pathname.startsWith(
                "/shorts/"
            )
        ) {

            videoId =
                url.pathname
                    .split("/shorts/")[1]
                    ?.split("/")[0];

        }

        if (
            !videoId &&
            url.pathname.startsWith(
                "/embed/"
            )
        ) {

            videoId =
                url.pathname
                    .split("/embed/")[1]
                    ?.split("/")[0];

        }

    }

    if (
        videoId &&
        /^[A-Za-z0-9_-]{11}$/.test(
            videoId
        )
    ) {

        return {

            type:
                "video",

            videoId

        };

    }

    return null;

}


// ======================================================
// LOAD SINGLE SONG
// ======================================================

function loadYouTubeVideo(videoId) {

    if (!videoId) {
        return;
    }

    if (applyingSharedPlaylist) {
        return;
    }

    addVideoToSharedQueue(videoId);

}


function addVideoToSharedQueue(videoId) {

    if (!socket || !roomCodeForSync) {
        // Fallback for a room-less local test.
        currentMediaType = "video";
        currentVideoId = videoId;
        player.loadVideoById(videoId);
        setPlaylistIndicator("Single song");
        updateAlbumArt(videoId);
        updateMusicControls();
        return;
    }

    socket.emit(
        "add-to-shared-playlist",
        {
            roomCode: roomCodeForSync,
            videoIds: [videoId]
        }
    );
}


// ======================================================
// LOAD PLAYLIST
// ======================================================

function loadYouTubePlaylist(playlistId) {

    if (!player || !playerReady) {
        return;
    }

    currentMediaType = "playlist";
    currentPlaylistId = playlistId;
    currentVideoId = null;
    discoveringYouTubePlaylist = true;

    console.log("Discovering YouTube playlist:", playlistId);

    player.loadPlaylist({
        list: playlistId,
        listType: "playlist",
        index: 0
    });

    setPlaylistIndicator("Loading playlist...");
    updateMusicControls();

    // Let YouTube populate getPlaylist(), then send the actual ordered
    // video IDs to the server. From this point onward the server owns it.
    setTimeout(() => {

        let discovered = [];

        try {
            discovered = player.getPlaylist() || [];
        } catch (error) {
            console.error("Could not read YouTube playlist:", error);
        }

        discoveringYouTubePlaylist = false;

        discovered = Array.from(
            new Set(
                discovered.filter(
                    id => /^[A-Za-z0-9_-]{11}$/.test(id)
                )
            )
        );

        if (!discovered.length) {
            showYouTubeError(
                "Could not read that YouTube playlist."
            );
            return;
        }

        if (socket && roomCodeForSync) {
            socket.emit(
                "add-to-shared-playlist",
                {
                    roomCode: roomCodeForSync,
                    videoIds: discovered
                }
            );
        } else {
            sharedPlaylist = discovered;
            applySharedPlaylist(discovered, 0, true);
        }

    }, 1400);

}


// ======================================================
// MAIN ALBUM ART
// ======================================================

function updateAlbumArt(videoId) {

    if (!videoId) {
        return;
    }

    const image =
        document.getElementById(
            "albumArt"
        );

    const placeholder =
        document.getElementById(
            "albumArtPlaceholder"
        );

    if (!image) {

        console.error(
            "albumArt element not found."
        );

        return;

    }

    const maxRes =
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    const highQuality =
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    image.onerror = () => {

        image.onerror = () => {

            image.style.display =
                "none";

            if (placeholder) {

                placeholder.style.display =
                    "grid";

            }

        };

        image.src =
            highQuality;

    };

    image.onload = () => {

        image.style.display =
            "block";

        if (placeholder) {

            placeholder.style.display =
                "none";

        }

    };

    image.src =
        maxRes;

}


// ======================================================
// NOW PLAYING
// ======================================================

function updateNowPlaying() {

    if (
        !player ||
        !playerReady
    ) {

        return;

    }

    let data = null;

    try {

        data =
            player.getVideoData();

    } catch {

        return;

    }

    if (!data) {
        return;
    }

    const videoId =
        data.video_id;

    if (videoId) {

        currentVideoId =
            videoId;

        updateAlbumArt(
            videoId
        );

    }

    const titleElement =
        document.getElementById(
            "currentSongTitle"
        );

    const artistElement =
        document.getElementById(
            "currentSongArtist"
        );

    if (titleElement) {

        titleElement.textContent =
            data.title ||
            "Nothing playing";

    }

    if (artistElement) {

        artistElement.textContent =
            data.author ||
            "YouTube";

    }

    renderQueue();

}


// ======================================================
// QUEUE
// ======================================================

async function renderQueue() {

    const queue =
        document.getElementById(
            "queueList"
        );

    const count =
        document.getElementById(
            "queueCount"
        );

    if (!queue) {
        return;
    }

    if (
        !player ||
        !playerReady ||
        currentMediaType !==
        "playlist"
    ) {

        queue.innerHTML =
            `
            <div class="queue-empty">
                Your playlist will appear here.
            </div>
            `;

        if (count) {

            count.textContent =
                "0 songs";

        }

        return;

    }

    let playlist = sharedPlaylist.slice();

    if (!playlist.length) {
        try {
            playlist = player.getPlaylist() || [];
        } catch {
            playlist = [];
        }
    }

    if (!playlist.length) {

        queue.innerHTML =
            `
            <div class="queue-empty">
                Loading playlist...
            </div>
            `;

        return;

    }

    let currentIndex = -1;

    try {

        currentIndex =
            player.getPlaylistIndex();

    } catch {

        currentIndex = -1;

    }

    if (count) {

        count.textContent =
            `${playlist.length} songs`;

    }

    const playlistKey =
        playlist.join("|");

    if (
        queue.dataset.playlistKey !==
        playlistKey
    ) {

        queue.dataset.playlistKey =
            playlistKey;

        queue.innerHTML = "";

        playlist.forEach(
            (videoId, index) => {

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "queue-item";

                item.dataset.videoId =
                    videoId;

                if (
                    index === currentIndex
                ) {

                    item.classList.add(
                        "active"
                    );

                }

                // NUMBER

                const number =
                    document.createElement(
                        "span"
                    );

                number.className =
                    "queue-number";

                number.textContent =
                    String(
                        index + 1
                    );

                // THUMBNAIL

                const thumb =
                    document.createElement(
                        "div"
                    );

                thumb.className =
                    "queue-thumb";

                const image =
                    document.createElement(
                        "img"
                    );

                image.className =
                    "queue-thumb-image";

                image.alt =
                    "Song artwork";

                image.loading =
                    "lazy";

                image.src =
                    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

                image.onerror =
                    () => {

                        thumb.innerHTML =
                            `<span class="queue-thumb-placeholder">♫</span>`;

                    };

                thumb.appendChild(
                    image
                );

                // TITLE

                const title =
                    document.createElement(
                        "span"
                    );

                title.className =
                    "queue-title";

                title.textContent =
                    "Loading song...";

                item.appendChild(
                    number
                );

                item.appendChild(
                    thumb
                );

                item.appendChild(
                    title
                );

                item.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(
                                item.dataset.index
                            );

                        if (
                            Number.isInteger(index)
                        ) {

                            if (socket && roomCodeForSync) {
                                socket.emit(
                                    "shared-playback-command",
                                    {
                                        roomCode: roomCodeForSync,
                                        action: "index",
                                        index,
                                        currentTime: 0
                                    }
                                );
                            } else {
                                player.playVideoAt(index);
                            }

                        }

                    }
                );

                item.dataset.index =
                    index;

                queue.appendChild(
                    item
                );

            }
        );

        loadQueueMetadata(
            playlist
        );

    }

    updateQueueActiveState(
        currentIndex
    );

}


// ======================================================
// QUEUE METADATA
// ======================================================

async function loadQueueMetadata(
    playlist
) {

    const queue =
        document.getElementById(
            "queueList"
        );

    if (!queue) {
        return;
    }

    const batchSize = 8;

    for (
        let start = 0;
        start < playlist.length;
        start += batchSize
    ) {

        const batch =
            playlist.slice(
                start,
                start + batchSize
            );

        const results =
            await Promise.all(
                batch.map(
                    getVideoMetadata
                )
            );

        results.forEach(
            (metadata, localIndex) => {

                const actualIndex =
                    start +
                    localIndex;

                const videoId =
                    playlist[
                        actualIndex
                    ];

                const item =
                    queue.querySelector(
                        `[data-video-id="${videoId}"]`
                    );

                if (!item) {
                    return;
                }

                const title =
                    item.querySelector(
                        ".queue-title"
                    );

                if (
                    title &&
                    metadata
                ) {

                    title.textContent =
                        metadata.title;

                }

                const image =
                    item.querySelector(
                        ".queue-thumb-image"
                    );

                if (
                    image &&
                    metadata?.thumbnail
                ) {

                    image.src =
                        metadata.thumbnail;

                }

            }
        );

    }

}


// ======================================================
// VIDEO METADATA
// ======================================================

async function getVideoMetadata(
    videoId
) {

    if (
        videoMetadataCache.has(
            videoId
        )
    ) {

        return videoMetadataCache.get(
            videoId
        );

    }

    const fallback = {

        id:
            videoId,

        title:
            "YouTube video",

        author:
            "YouTube",

        thumbnail:
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

    };

    try {

        const videoUrl =
            `https://www.youtube.com/watch?v=${videoId}`;

        const endpoint =
            `https://www.youtube.com/oembed?url=${encodeURIComponent(
                videoUrl
            )}&format=json`;

        const response =
            await fetch(
                endpoint
            );

        if (!response.ok) {

            throw new Error(
                "Metadata request failed."
            );

        }

        const data =
            await response.json();

        const metadata = {

            id:
                videoId,

            title:
                data.title ||
                fallback.title,

            author:
                data.author_name ||
                fallback.author,

            thumbnail:
                data.thumbnail_url ||
                fallback.thumbnail

        };

        videoMetadataCache.set(
            videoId,
            metadata
        );

        return metadata;

    } catch (error) {

        console.warn(
            "Metadata fallback:",
            videoId
        );

        videoMetadataCache.set(
            videoId,
            fallback
        );

        return fallback;

    }

}


// ======================================================
// QUEUE ACTIVE STATE
// ======================================================

function updateQueueActiveState(
    currentIndex
) {

    const queue =
        document.getElementById(
            "queueList"
        );

    if (!queue) {
        return;
    }

    const items =
        queue.querySelectorAll(
            ".queue-item"
        );

    items.forEach(
        (item, index) => {

            item.classList.toggle(
                "active",
                index === currentIndex
            );

        }
    );

}


// ======================================================
// MUSIC CONTROLS
// ======================================================

function updateMusicControls() {

    const playPause =
        document.getElementById(
            "playPauseButton"
        );

    const previous =
        document.getElementById(
            "previousButton"
        );

    const next =
        document.getElementById(
            "nextButton"
        );

    const seek =
        document.getElementById(
            "seekBar"
        );

    if (!playerReady) {

        if (playPause)
            playPause.disabled = true;

        if (previous)
            previous.disabled = true;

        if (next)
            next.disabled = true;

        if (seek)
            seek.disabled = true;

        return;

    }

    if (playPause) {

        playPause.disabled =
            !currentMediaType;

    }

    if (seek) {

        seek.disabled =
            !currentMediaType;

    }

    const playlistMode =
        currentMediaType ===
        "playlist";

    if (previous) {

        previous.disabled =
            !playlistMode;

    }

    if (next) {

        next.disabled =
            !playlistMode;

    }

    updatePlayPauseIcon();

}


// ======================================================
// PLAY / PAUSE
// ======================================================

const playPauseButton =
    document.getElementById(
        "playPauseButton"
    );


if (playPauseButton) {

    playPauseButton.addEventListener(
        "click",
        () => {

            if (
                !player ||
                !playerReady ||
                !currentMediaType
            ) {
                return;
            }

            const state = player.getPlayerState();
            const action =
                state === YT.PlayerState.PLAYING
                    ? "pause"
                    : "play";

            if (socket && roomCodeForSync) {
                socket.emit(
                    "shared-playback-command",
                    {
                        roomCode: roomCodeForSync,
                        action,
                        index: getCurrentSharedIndex(),
                        currentTime: player.getCurrentTime() || 0
                    }
                );
            } else if (action === "pause") {
                player.pauseVideo();
            } else {
                player.playVideo();
            }

        }
    );

}


// ======================================================
// PREVIOUS
// ======================================================

const previousButton =
    document.getElementById(
        "previousButton"
    );


if (previousButton) {

    previousButton.addEventListener(
        "click",
        () => {

            if (
                !player ||
                currentMediaType !==
                "playlist"
            ) {

                return;

            }

            const index = getCurrentSharedIndex();

            if (socket && roomCodeForSync) {
                socket.emit(
                    "shared-playback-command",
                    {
                        roomCode: roomCodeForSync,
                        action: "index",
                        index: Math.max(0, index - 1),
                        currentTime: 0
                    }
                );
            } else {
                player.previousVideo();
            }

        }
    );

}


// ======================================================
// NEXT
// ======================================================

const nextButton =
    document.getElementById(
        "nextButton"
    );


if (nextButton) {

    nextButton.addEventListener(
        "click",
        () => {

            if (
                !player ||
                currentMediaType !==
                "playlist"
            ) {

                return;

            }

            const index = getCurrentSharedIndex();

            if (socket && roomCodeForSync) {
                socket.emit(
                    "shared-playback-command",
                    {
                        roomCode: roomCodeForSync,
                        action: "index",
                        index: Math.min(
                            Math.max(0, sharedPlaylist.length - 1),
                            index + 1
                        ),
                        currentTime: 0
                    }
                );
            } else {
                player.nextVideo();
            }

        }
    );

}


function getCurrentSharedIndex() {

    if (!player || !playerReady) {
        return 0;
    }

    try {
        const index = player.getPlaylistIndex();
        return Number.isInteger(index) && index >= 0 ? index : 0;
    } catch {
        return 0;
    }
}


// ======================================================
// PLAY / PAUSE ICON
// ======================================================

function updatePlayPauseIcon() {

    const button =
        document.getElementById(
            "playPauseButton"
        );

    if (
        !button ||
        !player ||
        !playerReady
    ) {

        return;

    }

    const state =
        player.getPlayerState();

    if (
        state ===
        YT.PlayerState.PLAYING
    ) {

        button.textContent =
            "❚❚";

        button.setAttribute(
            "aria-label",
            "Pause"
        );

    } else {

        button.textContent =
            "▶";

        button.setAttribute(
            "aria-label",
            "Play"
        );

    }

}


// ======================================================
// SEEK BAR
// ======================================================

const seekBar =
    document.getElementById(
        "seekBar"
    );


if (seekBar) {

    seekBar.addEventListener(
        "input",
        () => {

            if (
                !player ||
                !playerReady
            ) {

                return;

            }

            isSeeking = true;

            const duration =
                player.getDuration();

            const percentage =
                Number(
                    seekBar.value
                );

            const time =
                (
                    duration *
                    percentage
                ) / 100;

            updateTimeDisplay(
                time,
                duration
            );

        }
    );

    seekBar.addEventListener(
        "change",
        () => {

            if (
                !player ||
                !playerReady
            ) {

                return;

            }

            const duration =
                player.getDuration();

            const percentage =
                Number(
                    seekBar.value
                );

            const time =
                (
                    duration *
                    percentage
                ) / 100;

            if (socket && roomCodeForSync) {
                socket.emit(
                    "shared-playback-command",
                    {
                        roomCode: roomCodeForSync,
                        action: "seek",
                        index: getCurrentSharedIndex(),
                        currentTime: time
                    }
                );
            } else {
                player.seekTo(time, true);
            }

            isSeeking = false;

        }
    );

}


// ======================================================
// PLAYBACK HEARTBEAT
// ======================================================

function startPlaybackHeartbeat() {

    stopPlaybackHeartbeat();

    if (!socket || !roomCodeForSync) {
        return;
    }

    playbackHeartbeatTimer = setInterval(() => {

        if (
            applyingRemotePlayback ||
            !player ||
            !playerReady ||
            player.getPlayerState() !== YT.PlayerState.PLAYING
        ) {
            return;
        }

        socket.emit(
            "shared-playback-heartbeat",
            {
                roomCode: roomCodeForSync,
                index: getCurrentSharedIndex(),
                currentTime: player.getCurrentTime() || 0
            }
        );

    }, 2000);

}


function stopPlaybackHeartbeat() {

    if (playbackHeartbeatTimer) {
        clearInterval(playbackHeartbeatTimer);
        playbackHeartbeatTimer = null;
    }

}


// ======================================================
// PROGRESS
// ======================================================

function startProgressTimer() {

    stopProgressTimer();

    progressTimer =
        setInterval(
            updateProgress,
            500
        );

}


function stopProgressTimer() {

    if (progressTimer) {

        clearInterval(
            progressTimer
        );

        progressTimer =
            null;

    }

}


function updateProgress() {

    if (
        !player ||
        !playerReady
    ) {

        return;

    }

    const duration =
        player.getDuration();

    const current =
        player.getCurrentTime();

    if (
        !duration ||
        duration <= 0
    ) {

        return;

    }

    if (!isSeeking) {

        const percentage =
            (
                current /
                duration
            ) * 100;

        const seek =
            document.getElementById(
                "seekBar"
            );

        if (seek) {

            seek.value =
                percentage;

        }

    }

    updateTimeDisplay(
        current,
        duration
    );

}


function updateTimeDisplay(
    current,
    duration
) {

    const currentElement =
        document.getElementById(
            "currentTime"
        );

    const durationElement =
        document.getElementById(
            "duration"
        );

    if (currentElement) {

        currentElement.textContent =
            formatTime(current);

    }

    if (durationElement) {

        durationElement.textContent =
            formatTime(duration);

    }

}


function formatTime(seconds) {

    if (
        !seconds ||
        !isFinite(seconds)
    ) {

        return "0:00";

    }

    const total =
        Math.floor(seconds);

    const minutes =
        Math.floor(
            total / 60
        );

    const secondsLeft =
        total % 60;

    return (
        minutes +
        ":" +
        String(
            secondsLeft
        ).padStart(
            2,
            "0"
        )
    );

}


// ======================================================
// METADATA REFRESH
// ======================================================

function startMetadataRefresh() {

    stopMetadataRefresh();

    updateNowPlaying();

    metadataTimer =
        setInterval(
            updateNowPlaying,
            1500
        );

}


function stopMetadataRefresh() {

    if (metadataTimer) {

        clearInterval(
            metadataTimer
        );

        metadataTimer =
            null;

    }

}


// ======================================================
// PLAYLIST INDICATOR
// ======================================================

function setPlaylistIndicator(
    text
) {

    const element =
        document.getElementById(
            "playlistIndicator"
        );

    if (element) {

        element.textContent =
            text;

    }

}


// ======================================================
// YOUTUBE ERROR UI
// ======================================================

function showYouTubeError(
    message
) {

    const element =
        document.getElementById(
            "youtubeError"
        );

    if (element) {

        element.textContent =
            message;

    }

}


function clearYouTubeError() {

    const element =
        document.getElementById(
            "youtubeError"
        );

    if (element) {

        element.textContent =
            "";

    }

}


// ======================================================
// HEART
// ======================================================

const heartButton =
    document.getElementById(
        "heartButton"
    );


if (heartButton) {

    heartButton.addEventListener(
        "click",
        () => {

            heartButton.textContent =
                "♥";

            showRoomMessage(
                "A little heart sent ♡"
            );

            setTimeout(
                () => {

                    heartButton.textContent =
                        "♡";

                },
                800
            );

        }
    );

}


// ======================================================
// STARTUP
// ======================================================

console.log(
    "Between Us app.js loaded."
);