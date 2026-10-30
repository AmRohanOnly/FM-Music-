tasks.register<Exec>("build") {
    commandLine("npm", "run", "build")
}

tasks.register<Exec>("assembleDebug") {
    commandLine("npm", "run", "build")
}
