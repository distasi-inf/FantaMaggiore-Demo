package it.fantamaggiore.backend.fantasy.service;

import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.model.enums.MatchDayStatus;
import it.fantamaggiore.backend.fantasy.model.Bet;
import it.fantamaggiore.backend.fantasy.model.Formation;
import it.fantamaggiore.backend.fantasy.model.Vote;
import it.fantamaggiore.backend.fantasy.repository.FormationRepository;
import it.fantamaggiore.backend.fantasy.repository.VoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FormationService {

    @Autowired
    private FormationRepository formationRepository;

    @Autowired
    private VoteRepository voteRepository;

    @CacheEvict(value = "globalRanking", allEntries = true) // 🔥 INDISPENSABILE per far aggiornare la classifica!
    @Transactional
    public void updateFormationScore(Long idFormation) {
        Formation formation = formationRepository.findById(idFormation)
                .orElseThrow(() -> new ResourceNotFoundException("Formation not found with id: " + idFormation));

        double totalScore = calculateScore(formation);

        formation.setTotalScore(totalScore);
        formationRepository.save(formation);
    }

    private double calculateScore(Formation formation) {
        double sum = 0.0;

        // 🔥 LA MAGIA: Se la lista ha 3 titolari, significa che 1 manca (Non Convocato). Quindi partiamo da 1 SV!
        int countSV = 4 - formation.getStarters().size();

        Long matchDayId = formation.getMatchDay().getId();

        // Controlliamo i titolari presenti
        for (Player p : formation.getStarters()) {
            java.util.Optional<Vote> voteOpt = voteRepository.findByPlayerIdAndMatchDayId(p.getId(), matchDayId);

            // Se ha il voto ed è maggiore di 0 lo sommiamo, altrimenti è Senza Voto (SV)
            if (voteOpt.isPresent() && voteOpt.get().getFantaVote() > 0) {
                sum += voteOpt.get().getFantaVote();
            } else {
                countSV++;
            }
        }

        // Subentro del panchinaro se c'è ALMENO un titolare SV o un "buco" (countSV >= 1)
        if (countSV >= 1 && formation.getSubstitutePlayer() != null) {
            java.util.Optional<Vote> subVoteOpt = voteRepository.findByPlayerIdAndMatchDayId(
                    formation.getSubstitutePlayer().getId(), matchDayId);

            if (subVoteOpt.isPresent() && subVoteOpt.get().getFantaVote() > 0) {
                sum += subVoteOpt.get().getFantaVote();
            }
        }
        return sum;
    }

    @Transactional
    public String saveFormation(User user, MatchDay matchDay, List<Player> players, Player substitute) {

        if (players == null || players.size() != 4) {
            throw new InvalidActionException("You must field exactly 4 starters!");
        }

        //Controllo della Deadline (Il mercato è chiuso?)
        if (matchDay.isExpired() || matchDay.getStatus() != MatchDayStatus.OPEN) {
            throw new InvalidActionException("Time's up! You can no longer add or edit lineups for this day.");
        }

        //Controllo duplicati (Il panchinaro è tra i titolari?)
        if (players.contains(substitute)) {
            throw new InvalidActionException("The benchwarmer cannot also be fielded among the starters!");
        }

        //Controllo convocati: I giocatori scelti fanno parte della lista fornita dall'Admin?
        List<Player> availablePlayers = matchDay.getAvailablePlayers();

        for (Player p : players) {
            if (!availablePlayers.contains(p)) {
                throw new InvalidActionException("The player " + p.getName() + " " + p.getSurname() + " is not available for this MatchDay!");
            }
        }

        if (substitute != null && !availablePlayers.contains(substitute)) {
            throw new InvalidActionException("The substitute player " + substitute.getName() + " is not available for this MatchDay!");
        }

        //Creazione o Aggiornamento
        Formation existingFormation = formationRepository.findByUserIdAndMatchDayId(user.getId(), matchDay.getId())
                .orElse(null);

        if (existingFormation != null) {
            existingFormation.setStarters(players);
            existingFormation.setSubstitutePlayer(substitute);
            formationRepository.save(existingFormation);
            return "Updated formation successfully!";
        } else {
            Formation newFormation = new Formation(user, matchDay, players, substitute);
            formationRepository.save(newFormation);
            return "Formation saved successfully!";
        }
    }

    @Transactional(readOnly = true)
    public Formation getFormationByIdUserIdMatchDay(Long idUser, Long idMatchDay) {
        return formationRepository.findByUserIdAndMatchDayId(idUser, idMatchDay)
                .orElseThrow(() -> new ResourceNotFoundException("The user has not selected a formation for this matchday."));
    }

    @Transactional(readOnly = true)
    public List<Formation> getFormationsByIdMatchDay(Long idMatchDay) {
        return formationRepository.findByMatchDayId(idMatchDay);
    }

    @Transactional(readOnly = true)
    public List<Formation> getFormationsByUserId(Long userId) {
        return formationRepository.getFormationByUserId(userId);
    }

    @Transactional
    public void deleteFormation(Long idFormation, String userEmail, String userRole) {
        Formation formation = formationRepository.findById(idFormation)
                .orElseThrow(() -> new ResourceNotFoundException("Formation not found"));

        // Solo l'ADMIN o il proprietario possono cancellare la formazione
        if (!formation.getUser().getEmail().equals(userEmail) && !userRole.equals("ROLE_ADMIN")) {
            throw new InvalidActionException("You don't have permission to delete this formation!");
        }

        if (formation.getMatchDay().getStatus() != MatchDayStatus.OPEN) {
            throw new InvalidActionException("Time's up! You cannot delete a formation for a closed matchday.");
        }

        formationRepository.delete(formation);
    }

    @Transactional
    public void deleteAllFormations(List<Formation> formations) {
        formationRepository.deleteAll(formations);
    }

    @Transactional(readOnly = true)
    public boolean hasUserSubmittedFormation(Long userId, Long matchDayId) {
        return formationRepository.existsByUserIdAndMatchDayId(userId, matchDayId);
    }

    @Transactional(readOnly = true)
    public Formation getFormationByUserIdAndMatchDayId(Long userId, Long matchDayId) {
        return formationRepository.findByUserIdAndMatchDayId(userId, matchDayId)
                .orElseThrow(() -> new ResourceNotFoundException("Formation not found for user " + userId + " in the match day " + matchDayId));
    }
}
