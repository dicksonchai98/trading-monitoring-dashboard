FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY SocialMediaApp.Web/SocialMediaApp.Web.csproj SocialMediaApp.Web/
RUN dotnet restore SocialMediaApp.Web/SocialMediaApp.Web.csproj

COPY . .
RUN dotnet publish SocialMediaApp.Web/SocialMediaApp.Web.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "SocialMediaApp.Web.dll"]
