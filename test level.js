loadLevelData({
    tileSize: 20,
    cols: 30,
    rows: 20,
    map: [
        [1, 1, 1, 0, 0],
        [1, 9, 0, 14, 0],           // Theseus + Enemy S
        [1, 0, {type:4,group:'A'}, 0, 15],  // OPEN A + Enemy X
        [1, {type:6,group:'A'}, 0, 16, 0],  // DOOR A + Timer
        [1, 0, {type:5,group:'A'}, 10, 3],  // CLOSE A + Key + Woman
    ]
});