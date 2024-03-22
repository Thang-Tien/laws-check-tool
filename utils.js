exports.msToTime = (duration) => {
    var milliseconds = Math.floor((duration % 1000) / 100),
        seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}

exports.sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

exports.specialAddAttribute = (object, addingAttribute, location) => {
    var objectValueArray = [];
    var temp2;
    for (var attribute in object) {
        objectValueArray.push({ [attribute]: object[attribute] });
    }

    index = 0;

    objectValueArray.splice(location, 0, addingAttribute);

    for (let i = 0; i < objectValueArray.length; i++) {
        temp2 = { ...temp2, ...objectValueArray[i] };
    }

    return temp2;

}