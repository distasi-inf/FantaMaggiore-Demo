package it.fantamaggiore.backend.fantasy.service;

import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.service.MatchDayService;
import it.fantamaggiore.backend.core.service.UserService;
import it.fantamaggiore.backend.fantasy.dto.LeagueRankingDTO;
import it.fantamaggiore.backend.fantasy.dto.RankingDTO;
import it.fantamaggiore.backend.fantasy.model.Bet;
import it.fantamaggiore.backend.fantasy.model.FantasyMatch;
import it.fantamaggiore.backend.fantasy.model.Formation;
import it.fantamaggiore.backend.fantasy.repository.FantasyMatchRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class FantasyMatchService {

    @Autowired
    private FantasyMatchRepository fantasyMatchRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private MatchDayService matchDayService;

    @Autowired
    private FormationService formationService;

    @Transactional
    public String generateCalendar() {
        if (fantasyMatchRepository.count() > 0) {
            throw new InvalidActionException("The calendar has already been generated!");
        }
        List<User> users = new ArrayList<>(userService.getAllUsers());
        List<MatchDay> matchDays = matchDayService.getAll();

        if (matchDays.isEmpty()) {
            throw new RuntimeException("Create MatchDays in the database first!");
        }

        if (users.size() < 2) {
            throw new RuntimeException("At least 2 users are required for a tournament!");
        }

        java.util.Collections.shuffle(users);

        // GESTIONE DISPARI: Se sono dispari, aggiungiamo un 'null' alla lista.
        // Chi scontrerà 'null' sarà a riposo.
        if (users.size() % 2 != 0) {
            users.add(null);
        }

        int totalTeams = users.size();
        int roundForGroup = totalTeams - 1;
        List<FantasyMatch> matches = new ArrayList<>();

        for (int i = 0; i < matchDays.size(); i++) {
            MatchDay currentMatchDay = matchDays.get(i);

            // Determiniamo quale giornata del girone stiamo calcolando
            int roundIdx = i % roundForGroup;

            for (int j = 0; j < totalTeams / 2; j++) {
                int team1Idx = (roundIdx + j) % (totalTeams - 1);
                int team2Idx = (totalTeams - 1 - j + roundIdx) % (totalTeams - 1);

                if (j == 0) {
                    team2Idx = totalTeams - 1;
                }

                User u1 = users.get(team1Idx);
                User u2 = users.get(team2Idx);

                // Se uno dei due è null, la partita non viene creata (Riposo)
                if (u1 != null && u2 != null) {
                    FantasyMatch fm = new FantasyMatch(currentMatchDay, u1, u2);
                    matches.add(fm);
                }
            }
        }

        fantasyMatchRepository.saveAll(matches);
        return "Generated calendar: " + matches.size() + " direct clashes created.";
    }

    private int resultsGol(double totalScore) {
        if (totalScore < 24) {
            return 0;
        }
        // Sottraiamo la base del primo gol (24) e dividiamo il resto per lo scarto (6)
        // Aggiungiamo 1 perché sappiamo già di aver superato i 24 punti
        return 1 + (int) ((totalScore - 24) / 6);
    }

    @Transactional
    public void updateResultsForMatchDay(Long idMatchDay) {
        List<FantasyMatch> fantasyMatches = fantasyMatchRepository.findByMatchDayId(idMatchDay);

        // FAI UNA SOLA QUERY AL DB!
        List<Formation> allFormations = formationService.getFormationsByIdMatchDay(idMatchDay);

        // Creiamo una mappa per cercarle velocemente in memoria (Key: UserId, Value: Formation)
        Map<Long, Formation> formationMap = allFormations.stream()
                .collect(Collectors.toMap(f -> f.getUser().getId(), f -> f));

        for (FantasyMatch match : fantasyMatches) {
            // Cerchiamo in memoria (istanteo), non nel DB!
            Formation f1 = formationMap.get(match.getUser1().getId());
            Formation f2 = formationMap.get(match.getUser2().getId());

            double score1 = (f1 != null && f1.getTotalScore() != null) ? f1.getTotalScore() : 0.0;
            double score2 = (f2 != null && f2.getTotalScore() != null) ? f2.getTotalScore() : 0.0;

            // Aggiorniamo i punteggi esatti
            match.setScoreUser1(score1);
            match.setScoreUser2(score2);

            // Calcoliamo i gol usando il tuo metodo resultsGol
            match.setGoalsUser1(resultsGol(score1));
            match.setGoalsUser2(resultsGol(score2));

            // Segniamo la partita come calcolata
            match.setCalculatedTrue();
        }
        fantasyMatchRepository.saveAll(fantasyMatches);
    }

    @Transactional(readOnly = true)
    public List<LeagueRankingDTO> getLeagueRanking() {
        List<FantasyMatch> fantasyMatches = fantasyMatchRepository.findByIsCalculated(true);

        // Mappa per ACCUMULARE i dati. Chiave: ID Utente, Valore: Il suo DTO classifica
        Map<Long, LeagueRankingDTO> rankingMap = new HashMap<>();

        for (FantasyMatch match : fantasyMatches) {
            // Recupero i DTO dalla mappa o li creo se è la prima volta che li vediamo
            LeagueRankingDTO r1 = rankingMap.computeIfAbsent(match.getUser1().getId(), id ->
                    new LeagueRankingDTO(match.getUser1().getFantasyTeamName(),
                            match.getUser1().getName() + " " + match.getUser1().getSurname()));

            LeagueRankingDTO r2 = rankingMap.computeIfAbsent(match.getUser2().getId(), id ->
                    new LeagueRankingDTO(match.getUser2().getFantasyTeamName(),
                            match.getUser2().getName() + " " + match.getUser2().getSurname()));

            //AGGIORNAMENTO DATI COMUNI
            r1.setPlayed(r1.getPlayed() + 1);
            r1.setGoalsFor(r1.getGoalsFor() + match.getGoalsUser1());
            r1.setGoalsAgainst(r1.getGoalsAgainst() + match.getGoalsUser2());
            r1.setTotalScoreSum(r1.getTotalScoreSum() + match.getScoreUser1());

            r2.setPlayed(r2.getPlayed() + 1);
            r2.setGoalsFor(r2.getGoalsFor() + match.getGoalsUser2());
            r2.setGoalsAgainst(r2.getGoalsAgainst() + match.getGoalsUser1());
            r2.setTotalScoreSum(r2.getTotalScoreSum() + match.getScoreUser2());

            //CALCOLO ESITO
            if (match.getGoalsUser1() > match.getGoalsUser2()) {
                r1.setPoints(r1.getPoints() + 3);
                r1.setWon(r1.getWon() + 1);
                r2.setLost(r2.getLost() + 1);
            } else if (match.getGoalsUser2() > match.getGoalsUser1()) {
                r2.setPoints(r2.getPoints() + 3);
                r2.setWon(r2.getWon() + 1);
                r1.setLost(r1.getLost() + 1);
            } else {
                r1.setPoints(r1.getPoints() + 1);
                r2.setPoints(r2.getPoints() + 1);
                r1.setDrawn(r1.getDrawn() + 1);
                r2.setDrawn(r2.getDrawn() + 1);
            }
        }

        //Trasformo la mappa in una lista e la ordino
        List<LeagueRankingDTO> results = new ArrayList<>(rankingMap.values());
        results.sort((a, b) -> {
            if (!b.getPoints().equals(a.getPoints()))
                return b.getPoints().compareTo(a.getPoints());

            if (!b.getTotalScoreSum().equals(a.getTotalScoreSum()))
                return b.getTotalScoreSum().compareTo(a.getTotalScoreSum());

            return b.getGoalDifference().compareTo(a.getGoalDifference());
        });
        return results;
    }


    @Transactional
    public void deleteAllFantasyMatch(List<FantasyMatch> fantasyMatches) {
        fantasyMatchRepository.deleteAll(fantasyMatches);
    }

    @Transactional(readOnly = true)
    public List<FantasyMatch> getFantasyMatchesByMatchDayId(Long id) {
        return fantasyMatchRepository.findByMatchDayId(id);
    }

    @Transactional(readOnly = true)
    public List<FantasyMatch> getLastFiveMatches(Long userId) {
        return fantasyMatchRepository.findLastMatchesByUserId(userId, PageRequest.of(0, 5));
    }


    @Transactional(readOnly = true)
    public List<FantasyMatch> getMyLastMatches(Long userId) {
        // Restituisce le ultime 5 partite in cui è coinvolto l'utente specifico
        // (la prima sarà quella in corso/da giocare, le altre saranno lo storico)
        return fantasyMatchRepository.findMyMatchesHistory(userId, PageRequest.of(0, 5));
    }
}
