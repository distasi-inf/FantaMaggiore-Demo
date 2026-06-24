# Fase 1: Costruzione (Build)
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests
# Trova l'eseguibile di Spring Boot e rinominalo per comodità
RUN find target -name "*.jar" ! -name "*plain.jar" -exec mv {} target/app.jar \;

# Fase 2: Esecuzione (Run)
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/app.jar .
EXPOSE 8080
ENTRYPOINT ["java", "-Xmx300m", "-jar", "app.jar"]