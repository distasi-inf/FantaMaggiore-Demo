package it.fantamaggiore.backend.fantasy.controller;

import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.service.MatchDayService;
import it.fantamaggiore.backend.core.service.PlayerService;
import it.fantamaggiore.backend.core.service.UserService;
import it.fantamaggiore.backend.fantasy.dto.FormationRequestDTO;
import it.fantamaggiore.backend.fantasy.dto.FormationResponseDTO;
import it.fantamaggiore.backend.fantasy.mapper.FormationMapper;
import it.fantamaggiore.backend.fantasy.model.Formation;
import it.fantamaggiore.backend.fantasy.service.FormationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/formations")
public class FormationController {

    @Autowired
    private MatchDayService matchDayService;

    @Autowired
    private UserService userService;

    @Autowired
    private PlayerService playerService;

    @Autowired
    private FormationService formationService;

    @Autowired
    private FormationMapper formationMapper;

    @PostMapping()
    public ResponseEntity<String> saveUpdateFormation(Authentication authentication, @RequestBody FormationRequestDTO formationDTO) {
        MatchDay matchDay = matchDayService.getMatchDayById(formationDTO.getMatchDayId());
        Player sub = formationDTO.getSubId() != null ? playerService.getPlayerById(formationDTO.getSubId()) : null;

        User user = userService.getUserByEmail(authentication.getName());

        // 🔥 FIX QUI: Aggiunto new ArrayList<>(...) per rendere la lista modificabile da Hibernate!
        List<Player> players = new ArrayList<>(formationDTO.getStarterIds().stream()
                .map(id -> playerService.getPlayerById(id))
                .toList());

        return ResponseEntity.ok(formationService.saveFormation(user, matchDay, players, sub));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteFormation(@PathVariable Long id, Authentication authentication) {
        // Preleviamo ruolo ed email per i controlli di sicurezza
        String email = authentication.getName();
        String role = authentication.getAuthorities().iterator().next().getAuthority();

        formationService.deleteFormation(id, email, role);
        return ResponseEntity.ok("Formation deleted successfully");
    }

    @GetMapping("/user/{idUser}/matchDay/{idMatchDay}")
    public ResponseEntity<FormationResponseDTO> getFormation(@PathVariable Long idUser, @PathVariable Long idMatchDay) {
        return ResponseEntity.ok(formationMapper.toDTO(
                        formationService.getFormationByIdUserIdMatchDay(
                                idUser, idMatchDay)
                )
        );
    }

    @GetMapping("/me")
    public ResponseEntity<List<FormationResponseDTO>> getMyFormations(Authentication authentication) {
        User user = userService.getUserByEmail(authentication.getName());
        // Aggiungi in FormationRepository: List<Formation> findByUserId(Long userId);
        List<FormationResponseDTO> myFormations = formationService.getFormationsByUserId(user.getId()).stream()
                .map(formationMapper::toDTO)
                .toList();
        return ResponseEntity.ok(myFormations);
    }

    @GetMapping("/me/matchDay/{idMatchDay}")
    public ResponseEntity<FormationResponseDTO> getMyFormationForMatchDay(@PathVariable Long idMatchDay, Authentication authentication) {
        User user = userService.getUserByEmail(authentication.getName());
        return ResponseEntity.ok(formationMapper.toDTO(
                formationService.getFormationByIdUserIdMatchDay(user.getId(), idMatchDay)
        ));
    }

    @GetMapping("/matchday/{matchDayId}/mine/exists")
    public ResponseEntity<Boolean> checkFormationSubmitted(@PathVariable Long matchDayId, Authentication authentication) {
        // Estraiamo l'utente loggato esattamente come fai negli altri endpoint
        User user = userService.getUserByEmail(authentication.getName());

        // Controlliamo se esiste la formazione
        boolean exists = formationService.hasUserSubmittedFormation(user.getId(), matchDayId);

        return ResponseEntity.ok(exists);
    }

    @GetMapping("/matchDay/{matchDayId}/user/{userId}")
    public ResponseEntity<FormationResponseDTO> getUserFormation(
            @PathVariable Long matchDayId,
            @PathVariable Long userId) {
        Formation formation = formationService.getFormationByUserIdAndMatchDayId(userId, matchDayId);
        return ResponseEntity.ok(formationMapper.toDTO(formation));
    }
}
